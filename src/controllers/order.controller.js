const orderService = require('../services/order.service');
const dispatchService = require('../services/dispatch.service');
const dispatchCandidateService = require('../services/dispatch-candidate.service');
const quoteService = require('../services/quote.service');
const completionService = require('../services/completion.service');
const disputeService = require('../services/dispute.service');
const lineMessageService = require('../services/line-message.service');
const userRepository = require('../repositories/user.repository');
const {
  reviewApprovedMessage,
  platformCancelledMessage,
} = require('../templates/customer-messages');
const { ORDER_STATUS } = require('../utils/order-status');

async function notifyCustomerReviewApproved(order) {
  const customer = await userRepository.findById(order.customer_id);
  if (!customer?.line_user_id) {
    console.warn(
      '[review:customer-approved-push:skip]',
      JSON.stringify({
        reason: 'missing_customer_line_user_id',
        orderId: order.id,
        customerId: order.customer_id,
      })
    );
    return;
  }

  console.log(
    '[review:customer-approved-push]',
    JSON.stringify({
      orderId: order.id,
      orderNo: order.order_no,
      customerId: customer.id,
      customerLineUserId: customer.line_user_id,
    })
  );
  await lineMessageService.pushMessages(
    customer.line_user_id,
    reviewApprovedMessage(order)
  );
}

async function notifyCustomerPlatformCancelled(order) {
  const customer = await userRepository.findById(order.customer_id);
  if (!customer?.line_user_id) {
    console.warn(
      '[cancel:customer-push:skip]',
      JSON.stringify({
        reason: 'missing_customer_line_user_id',
        orderId: order.id,
        customerId: order.customer_id,
      })
    );
    return;
  }

  console.log(
    '[cancel:customer-push]',
    JSON.stringify({
      orderId: order.id,
      orderNo: order.order_no,
      customerId: customer.id,
      customerLineUserId: customer.line_user_id,
      reason: order.cancel_reason_text,
    })
  );
  await lineMessageService.pushMessages(
    customer.line_user_id,
    platformCancelledMessage(order)
  );
}

async function listOrders(req, res, next) {
  try {
    res.json({ data: await orderService.listOrders(req.query) });
  } catch (error) {
    next(error);
  }
}

async function getOrder(req, res, next) {
  try {
    res.json({ data: await orderService.getOrderDetail(req.params.id) });
  } catch (error) {
    next(error);
  }
}

async function reviewOrder(req, res, next) {
  try {
    const statusMap = {
      approve: ORDER_STATUS.PENDING_DISPATCH,
      request_more_info: ORDER_STATUS.WAITING_CUSTOMER_INFO,
      reject: ORDER_STATUS.PLATFORM_CANCELLED,
    };
    if (!statusMap[req.body.action])
      return res.status(400).json({ error: 'Invalid review action' });
    const data = await orderService.transitionOrder(
      req.params.id,
      statusMap[req.body.action],
      `review_${req.body.action}`,
      'admin',
      null,
      req.body.note,
      req.body.action === 'reject'
        ? {
            cancelled_by: 'platform',
            cancel_reason_code: 'review_reject',
            cancel_reason_text: req.body.note || '案件未通過平台審核',
          }
        : {}
    );
    if (req.body.action === 'approve') {
      await notifyCustomerReviewApproved(data);
    }
    if (req.body.action === 'reject') {
      await notifyCustomerPlatformCancelled({
        ...data,
        cancel_reason_text: req.body.note || '案件未通過平台審核',
      });
    }
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function dispatchOrder(req, res, next) {
  try {
    const technicianIds = req.body.technician_ids || [];
    const data = technicianIds.length
      ? await dispatchService.dispatchOrder(req.params.id, technicianIds)
      : await dispatchService.autoDispatchOrder(req.params.id);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

async function listDispatchCandidates(req, res, next) {
  try {
    res.json({
      data: await dispatchCandidateService.listDispatchCandidates(req.params.id),
    });
  } catch (error) {
    next(error);
  }
}

async function assignOrder(req, res, next) {
  try {
    res.json({
      data: await dispatchService.assignOrder(
        req.params.id,
        req.body.technician_id
      ),
    });
  } catch (error) {
    next(error);
  }
}

async function cancelOrder(req, res, next) {
  try {
    const data = await orderService.cancelOrder(req.params.id, req.body);
    if (data.cancelled_by === 'platform') {
      await notifyCustomerPlatformCancelled(data);
    }
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function platformReview(req, res, next) {
  try {
    res.json({
      data: await disputeService.platformReview(req.params.id, req.body.reason),
    });
  } catch (error) {
    next(error);
  }
}

async function arrive(req, res, next) {
  try {
    res.json({
      data: await completionService.arrive(
        req.params.id,
        req.body.technician_id
      ),
    });
  } catch (error) {
    next(error);
  }
}

async function quote(req, res, next) {
  try {
    res.json({
      data: await quoteService.submitQuote(
        req.params.id,
        req.body,
        req.body.technician_id
      ),
    });
  } catch (error) {
    next(error);
  }
}

async function changeRequest(req, res, next) {
  try {
    res.json({
      data: await quoteService.submitChangeRequest(
        req.params.id,
        req.body,
        req.body.technician_id
      ),
    });
  } catch (error) {
    next(error);
  }
}

async function complete(req, res, next) {
  try {
    res.json({
      data: await completionService.complete(
        req.params.id,
        req.body,
        req.body.technician_id
      ),
    });
  } catch (error) {
    next(error);
  }
}

async function customerConfirmQuote(req, res, next) {
  try {
    res.json({
      data: await quoteService.confirmQuote(
        req.params.id,
        Boolean(req.body.accepted),
        req.body.customer_id
      ),
    });
  } catch (error) {
    next(error);
  }
}

async function customerConfirmCompletion(req, res, next) {
  try {
    res.json({
      data: await completionService.customerConfirmCompletion(
        req.params.id,
        req.body,
        req.body.customer_id
      ),
    });
  } catch (error) {
    next(error);
  }
}

async function customerDispute(req, res, next) {
  try {
    res.json({
      data: await disputeService.customerDispute(
        req.params.id,
        req.body.reason,
        req.body.customer_id
      ),
    });
  } catch (error) {
    next(error);
  }
}

async function addAdminNote(req, res, next) {
  try {
    res.status(201).json({
      data: await orderService.addAdminNote(req.params.id, req.body.note),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listOrders,
  getOrder,
  reviewOrder,
  listDispatchCandidates,
  dispatchOrder,
  assignOrder,
  cancelOrder,
  platformReview,
  arrive,
  quote,
  changeRequest,
  complete,
  customerConfirmQuote,
  customerConfirmCompletion,
  customerDispute,
  addAdminNote,
};
