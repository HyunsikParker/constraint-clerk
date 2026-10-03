import test from 'node:test';
import assert from 'node:assert/strict';
import {createContentAgent} from 'content-agent';
import {boundedSanityFetch} from '../server/bounded-fetch.ts';

test('the installed provider preserves text and tool calls across fragmented SSE packets',async()=>{
  const lines=[
    {type:'text-delta',delta:'통로 690 mm.'},
    {type:'tool-input-available',toolCallId:'packet-1',toolName:'check_plan',input:{}},
    {type:'finish',finishReason:'tool-calls'},
  ].map(value=>`data: ${JSON.stringify(value)}\n\n`).join('')+'data: [DONE]\n\n';
  const bytes=new TextEncoder().encode(lines);
  let offset=0,requests=0;
  const mockFetch:typeof fetch=async()=>{
    requests++;
    return new Response(new ReadableStream<Uint8Array>({
      pull(controller){
        if(offset>=bytes.length){controller.close();return;}
        controller.enqueue(bytes.slice(offset,offset+5));offset+=5;
      },
    }),{headers:{'content-type':'text/event-stream'}});
  };
  // This is an entirely local transport regression, not a live model/MCP probe.
  const provider=createContentAgent({organizationId:'localtest',fetch:boundedSanityFetch(mockFetch,1024)});
  const reply=await provider.agent('local-packet-test').doGenerate({prompt:[{role:'user',content:[{type:'text',text:'Local packet fixture only.'}]}]});
  assert.deepEqual(reply.content.filter(part=>part.type==='text'),[{type:'text',text:'통로 690 mm.'}]);
  assert.equal(reply.content.filter(part=>part.type==='tool-call').length,1);
  assert.equal(reply.finishReason.unified,'tool-calls');
  assert.equal(requests,1);
});
