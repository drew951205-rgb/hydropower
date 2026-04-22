const fileUploadService = require('../services/file-upload.service');
const orderService = require('../services/order.service');
const quoteService = require('../services/quote.service');
const completionService = require('../services/completion.service');
const supportTicketService = require('../services/support-ticket.service');
const lineMessageService = require('../services/line-message.service');
const { customerReviewThanksMessage } = require('../templates/customer-messages');
const userRepository = require('../repositories/user.repository');
const orderRepository = require('../repositories/order.repository');
const sessionRepository = require('../repositories/session.repository');
const { env } = require('../config/env');
const { ORDER_STATUS } = require('../utils/order-status');

const ACTIVE_TECHNICIAN_STATUSES = [
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.QUOTED,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.ARRIVED,
  ORDER_STATUS.COMPLETED_PENDING_CUSTOMER,
  ORDER_STATUS.PLATFORM_REVIEW,
];

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function forbidden(message) {
  return Object.assign(new Error(message), { statusCode: 403 });
}

function serviceModeFromText(text = '') {
  return /越快|馬上|立即|急|現在|今天/.test(String(text)) ? 'urgent' : 'scheduled';
}

function lineUserIdFrom(req) {
  return (
    req.body?.line_user_id ||
    req.query?.line_user_id ||
    req.headers['x-line-user-id'] ||
    ''
  );
}

function isAccepted(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

async function resolveUser(req, defaults = {}) {
  const lineUserId = String(lineUserIdFrom(req) || '').trim();
  if (!lineUserId) throw badRequest('Missing LINE user id');

  return userRepository.findOrCreateByLineUserId(lineUserId, defaults);
}

async function uploadFormImages(files = [], category) {
  if (!files.length) return [];

  const validationError = fileUploadService.validateImages(files);
  if (validationError) throw badRequest(validationError);

  const uploaded = await fileUploadService.uploadImages(files, category);
  return uploaded.map((item) => item.url);
}

async function getConfig(req, res) {
  res.json({
    data: {
      liffId: env.liffId,
      publicBaseUrl: env.publicBaseUrl,
    },
  });
}

async function getCustomerProfile(req, res, next) {
  try {
    const user = await resolveUser(req, { role: 'customer' });
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}

async function updateCustomerProfile(req, res, next) {
  try {
    if (!isAccepted(req.body.member_terms_accepted)) {
      throw badRequest('請先閱讀並同意會員條款');
    }

    const user = await resolveUser(req, { role: 'customer' });
    const changes = {
      name: String(req.body.name || '').trim() || null,
      phone: String(req.body.phone || '').trim() || null,
      default_address: String(req.body.default_address || '').trim() || null,
      preferred_area: String(req.body.preferred_area || '').trim() || null,
      is_member: true,
      member_terms_accepted_at: new Date().toISOString(),
      role: user.role === 'admin' || user.role === 'technician' ? user.role : 'customer',
      status: user.status || 'active',
      line_display_name: String(req.body.line_display_name || '').trim() || undefined,
      line_picture_url: String(req.body.line_picture_url || '').trim() || undefined,
      line_language: String(req.body.line_language || '').trim() || undefined,
    };

    const updated = await updateCustomerProfileWithFallback(user.id, changes);
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}

async function updateCustomerProfileWithFallback(userId, changes) {
  const attempts = [
    changes,
    {
      name: changes.name,
      phone: changes.phone,
      default_address: changes.default_address,
      preferred_area: changes.preferred_area,
      role: changes.role,
      status: changes.status,
    },
    {
      name: changes.name,
      phone: changes.phone,
      role: changes.role,
      status: changes.status,
    },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await userRepository.updateUser(userId, attempt);
    } catch (error) {
      lastError = error;
      console.warn('[customer-profile:update:fallback]', JSON.stringify({
        userId,
        message: error.message,
      }));
    }
  }

  throw lastError;
}

async function createRepair(req, res, next) {
  try {
    if (!isAccepted(req.body.terms_accepted)) {
      throw badRequest('請先閱讀並同意平台條款');
    }

    const user = await resolveUser(req, {
      role: 'customer',
      name: req.body.line_display_name,
      line_display_name: req.body.line_display_name,
      line_picture_url: req.body.line_picture_url,
      line_language: req.body.line_language,
    });
    const required = [
      'contact_name',
      'service_type',
      'area',
      'address',
      'preferred_time_text',
      'issue_description',
      'contact_phone',
    ];
    for (const field of required) {
      if (!String(req.body[field] || '').trim()) {
        throw badRequest(`Missing required field: ${field}`);
      }
    }

    const images = await uploadFormImages(req.files, 'issue');
    const order = await orderService.createRepairOrder(user, {
      service_type: req.body.service_type,
      area: req.body.area,
      address: req.body.address,
      preferred_time_text: req.body.preferred_time_text,
      service_mode: serviceModeFromText(req.body.preferred_time_text),
      issue_description: req.body.issue_description,
      contact_name: req.body.contact_name,
      contact_phone: req.body.contact_phone,
      images,
    });

    await userRepository.updateUser(user.id, {
      name: req.body.contact_name,
      phone: req.body.contact_phone,
      default_address: req.body.address,
      preferred_area: req.body.area,
    }).catch(() =>
      userRepository.updateUser(user.id, { phone: req.body.contact_phone })
    );

    res.status(201).json({ data: order });
  } catch (error) {
    next(error);
  }
}

async function getOrder(req, res, next) {
  try {
    const user = await resolveUser(req);
    const order = await orderService.getOrderDetail(req.params.id);
    if (
      String(order.customer_id) !== String(user.id) &&
      String(order.technician_id) !== String(user.id)
    ) {
      throw forbidden('You cannot access this order');
    }

    const technician = order.technician_id
      ? await userRepository.findById(order.technician_id)
      : null;
    res.json({ data: { ...order, technician } });
  } catch (error) {
    next(error);
  }
}

async function listTechnicianOrders(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (user.role !== 'technician') throw forbidden('Technician role required');

    const lists = await Promise.all(
      ACTIVE_TECHNICIAN_STATUSES.map((status) =>
        orderRepository.listOrders({ technician_id: user.id, status })
      )
    );
    res.json({ data: lists.flat() });
  } catch (error) {
    next(error);
  }
}

async function listCustomerOrders(req, res, next) {
  try {
    const user = await resolveUser(req, { role: 'customer' });
    const orders = await orderRepository.listOrders({ customer_id: user.id });
    const sorted = orders
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    res.json({ data: sorted });
  } catch (error) {
    next(error);
  }
}

async function submitQuote(req, res, next) {
  try {
    const user = await resolveUser(req);
    const order = await orderRepository.findById(req.params.id);
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    if (String(order.technician_id) !== String(user.id)) {
      throw forbidden('Technician does not own this order');
    }

    const basicFee = Number(req.body.basic_fee || 0);
    const materialFee = Number(req.body.material_fee || 0);
    const laborFee = Number(req.body.labor_fee || 0);
    const amount = basicFee + materialFee + laborFee;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw badRequest('Quote amount must be greater than 0');
    }

    const note = [
      `基本費：${basicFee}`,
      `材料費：${materialFee}`,
      `工資：${laborFee}`,
      req.body.estimated_arrival_time
        ? `預計到場：${req.body.estimated_arrival_time}`
        : '',
      req.body.note ? `備註：${req.body.note}` : '',
    ].filter(Boolean).join('\n');

    const data = await quoteService.submitQuote(
      order.id,
      {
        amount,
        note,
        estimated_arrival_time: String(req.body.estimated_arrival_time || '').trim() || null,
      },
      user.id
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function submitChangeRequest(req, res, next) {
  try {
    const user = await resolveUser(req);
    const order = await orderRepository.findById(req.params.id);
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    if (String(order.technician_id) !== String(user.id)) {
      throw forbidden('Technician does not own this order');
    }

    const amount = Number(req.body.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw badRequest('Change request amount must be greater than 0');
    }

    const images = await uploadFormImages(req.files, 'change_request');
    const data = await quoteService.submitChangeRequest(
      order.id,
      {
        amount,
        reason: req.body.reason || '追加報價',
        images,
      },
      user.id
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function confirmQuote(req, res, next) {
  try {
    const user = await resolveUser(req);
    const order = await orderRepository.findById(req.params.id);
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    if (String(order.customer_id) !== String(user.id)) {
      throw forbidden('Customer does not own this order');
    }
    const data = await quoteService.confirmQuote(
      req.params.id,
      req.body.accepted === true || req.body.accepted === 'true',
      user.id
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function confirmCompletion(req, res, next) {
  try {
    const user = await resolveUser(req);
    const order = await orderRepository.findById(req.params.id);
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    if (String(order.customer_id) !== String(user.id)) {
      throw forbidden('Customer does not own this order');
    }
    const data = await completionService.customerConfirmCompletion(
      req.params.id,
      {
        confirmed: req.body.confirmed === true || req.body.confirmed === 'true',
        paid_amount: req.body.paid_amount,
        rating: req.body.rating ? Number(req.body.rating) : undefined,
        comment: req.body.comment,
      },
      user.id
    );
    if (data.status === ORDER_STATUS.CLOSED && user.line_user_id) {
      await sessionRepository.clearForUser(user.id);
      await lineMessageService.pushMessages(user.line_user_id, customerReviewThanksMessage());
    }
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function submitCustomerReview(req, res, next) {
  try {
    const user = await resolveUser(req);
    const data = await completionService.submitCustomerReview(
      req.params.id,
      {
        rating: Number(req.body.rating),
        comment: req.body.comment,
      },
      user.id
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function submitTechnicianReview(req, res, next) {
  try {
    const user = await resolveUser(req);
    const data = await completionService.submitTechnicianReview(
      req.params.id,
      user.id,
      req.body.comment
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function submitSupportTicket(req, res, next) {
  try {
    const user = await resolveUser(req, { role: 'customer' });
    const images = await uploadFormImages(req.files, 'support');
    const data = await supportTicketService.createSupportTicket(user, {
      ...req.body,
      image_urls: images,
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

async function cancelOrderByCustomer(req, res, next) {
  try {
    const user = await resolveUser(req, { role: 'customer' });
    const data = await supportTicketService.cancelOrderByCustomer(
      user,
      req.params.id,
      req.body
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function cancelOrderByTechnician(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (user.role !== 'technician') throw forbidden('Technician role required');
    const data = await supportTicketService.cancelOrderByTechnician(
      user,
      req.params.id,
      req.body
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getConfig,
  getCustomerProfile,
  updateCustomerProfile,
  createRepair,
  getOrder,
  listCustomerOrders,
  listTechnicianOrders,
  submitQuote,
  submitChangeRequest,
  confirmQuote,
  confirmCompletion,
  submitCustomerReview,
  submitTechnicianReview,
  submitSupportTicket,
  cancelOrderByCustomer,
  cancelOrderByTechnician,
};
