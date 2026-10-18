import { createSocialHubDeployment } from '../server/generated/social-hub-deployment.js';
import { createSocialHubNodeHandler } from '../server/social-hub-http.js';
export const config = { api: { bodyParser: false } };
const deployment = createSocialHubDeployment(process.env);
export default createSocialHubNodeHandler({ kind: 'webhook', origin: process.env.SOCIAL_HUB_ORIGIN, deployment });
