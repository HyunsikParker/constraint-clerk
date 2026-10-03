import {defineConfig} from 'sanity';
import {structureTool} from 'sanity/structure';
import {schemaTypes} from './schema.ts';
const projectId=process.env.SANITY_STUDIO_PROJECT_ID;
if (!projectId || projectId==='0k0a3q37') throw new Error('Set the separate Constraint Clerk project ID. The published Alibi Atlas project is excluded.');
export default defineConfig({name:'constraint-clerk',title:'Constraint Clerk — North Pier Room',projectId,dataset:'production',plugins:[structureTool()],schema:{types:schemaTypes}});
