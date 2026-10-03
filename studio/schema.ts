import {defineType,defineField} from 'sanity';
const sourceRef={type:'reference',to:[{type:'ccSource'}]};
export const schemaTypes=[
  defineType({name:'ccSource',title:'Venue source',type:'document',fields:[
    defineField({name:'title',title:'Source title',type:'string',validation:r=>r.required()}),
    defineField({name:'kind',type:'string',options:{list:['brief','equipment','passage','route','roster','closure']},validation:r=>r.required()}),
    defineField({name:'body',title:'Original source text',type:'text',validation:r=>r.required()}),
    defineField({name:'refs',title:'Related venue records',type:'array',of:[sourceRef]}),
    defineField({name:'durationMinutes',title:'Route travel time (minutes)',type:'number',validation:r=>r.integer().min(1)}),
    defineField({name:'crew',title:'Available crew',type:'number',validation:r=>r.integer().min(0).max(4)}),
    defineField({name:'start',title:'Window starts (HH:MM)',type:'string'}),
    defineField({name:'end',title:'Window ends (HH:MM)',type:'string'}),
  ]}),
  defineType({name:'ccClaim',title:'Measured or required constraint',type:'document',fields:[
    defineField({name:'title',title:'Claim title',type:'string',validation:r=>r.required()}),
    defineField({name:'body',title:'What this source actually says',type:'text',validation:r=>r.required()}),
    defineField({name:'target',title:'Applies to',...sourceRef,validation:r=>r.required()}),
    defineField({name:'property',type:'string',options:{list:['clearWidthMm','widthMm','foldedWidthMm','foldCrew','foldMinutes']},validation:r=>r.required()}),
    defineField({name:'value',title:'Documented value (leave empty if unknown)',type:'number',validation:r=>r.min(0)}),
    defineField({name:'effectiveFrom',title:'Effective from',type:'date',validation:r=>r.required()}),
    defineField({name:'supersedes',title:'Explicitly replaces this earlier claim',type:'reference',to:[{type:'ccClaim'}]}),
  ]}),
];
