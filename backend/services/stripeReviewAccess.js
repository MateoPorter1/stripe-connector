// A dedicated review workspace can collect only in a Stripe general sandbox.
// The trusted identity comes from server configuration, never from the browser.
function isReviewUser(userId, env = process.env) {
  return Boolean(env.STRIPE_APP_REVIEW_USER_ID && String(userId) === env.STRIPE_APP_REVIEW_USER_ID);
}
function hasSandboxReviewAccess(userId, connection, env = process.env) {
  return isReviewUser(userId, env) && connection?.status === 'active' && connection.mode === 'sandbox';
}
module.exports = { isReviewUser, hasSandboxReviewAccess };
