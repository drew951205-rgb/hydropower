const userRepository = require('../repositories/user.repository');
const lineMessageService = require('./line-message.service');

function buildProfileChanges(user, profile) {
  const changes = {};

  if (!user.name && profile.displayName) changes.name = profile.displayName;
  if (profile.displayName) changes.line_display_name = profile.displayName;
  if (profile.pictureUrl) changes.line_picture_url = profile.pictureUrl;
  if (profile.language) changes.line_language = profile.language;

  return changes;
}

async function syncLineProfile(user) {
  if (!user?.id || !user.line_user_id) return user;

  const profile = await lineMessageService.getProfile(user.line_user_id);
  if (!profile) return user;

  const changes = buildProfileChanges(user, profile);
  if (!Object.keys(changes).length) return user;

  try {
    return await userRepository.updateUser(user.id, changes);
  } catch (error) {
    console.warn('[line-profile:sync:partial-fallback]', JSON.stringify({
      userId: user.id,
      lineUserId: user.line_user_id,
      message: error.message
    }));

    if (!user.name && profile.displayName) {
      return userRepository.updateUser(user.id, { name: profile.displayName });
    }

    return user;
  }
}

module.exports = { syncLineProfile, buildProfileChanges };
