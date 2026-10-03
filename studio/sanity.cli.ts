import {defineCliConfig} from 'sanity/cli';
const projectId=process.env.SANITY_STUDIO_PROJECT_ID;
if (!projectId || projectId==='0k0a3q37') throw new Error('Use only the new Constraint Clerk project.');
export default defineCliConfig({api:{projectId,dataset:'production'},deployment:{autoUpdates:false}});
