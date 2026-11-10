const {test}=require('node:test'),assert=require('node:assert/strict');
const {isReviewUser,hasSandboxReviewAccess}=require('../services/stripeReviewAccess');
const env={STRIPE_APP_REVIEW_USER_ID:'review_user'};
test('review allowance is restricted to the configured workspace and active general sandbox',()=>{
 assert.equal(hasSandboxReviewAccess('review_user',{mode:'sandbox',status:'active'},env),true);
 for(const mode of ['live','test',undefined])assert.equal(hasSandboxReviewAccess('review_user',{mode,status:'active'},env),false);
 for(const status of ['disconnected','reconnect_required',undefined])assert.equal(hasSandboxReviewAccess('review_user',{mode:'sandbox',status},env),false);
 assert.equal(hasSandboxReviewAccess('other_user',{mode:'sandbox',status:'active'},env),false);
 assert.equal(hasSandboxReviewAccess('review_user',null,env),false);
 assert.equal(isReviewUser('review_user',{}),false);
 assert.equal(isReviewUser('',{}),false);
});
