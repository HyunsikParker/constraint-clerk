export function boundedSanityFetch(fetcher:typeof fetch=fetch,maxBytes=524_288,onRequest?:()=>void):typeof fetch {
  return async (input,init) => {
    const url=new URL(typeof input==='string'?input:input instanceof URL?input:input.url);
    if (url.origin!=='https://api.sanity.io' || url.username || url.password) throw new Error('The model transport may call only the official Sanity API.');
    onRequest?.();
    const response=await fetcher(input,init);
    const declared=Number(response.headers.get('content-length'));
    if (declared>maxBytes) {await response.body?.cancel();throw new Error('The model response exceeded the byte limit.');}
    if (!response.body) return response;
    const reader=response.body.getReader();let seen=0;
    const isSse=response.headers.get('content-type')?.includes('text/event-stream')===true;
    const decoder=new TextDecoder('utf-8',{fatal:true}),encoder=new TextEncoder();
    let pending='';
    const stream=new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          while(true){
            const {done,value}=await reader.read();
            if(done){
              if(isSse){pending+=decoder.decode();if(pending)controller.enqueue(encoder.encode(pending));}
              controller.close();return;
            }
            seen+=value.byteLength;
            if(seen>maxBytes){await reader.cancel();controller.error(new Error('The model response exceeded the byte limit.'));return;}
            if(!isSse){controller.enqueue(value);return;}
            // content-agent 1.3.1 doGenerate parses each transport packet as
            // complete lines. Reassemble lines here without modifying the SDK;
            // the original-byte cap above also bounds this partial-line buffer.
            pending+=decoder.decode(value,{stream:true});
            const boundary=pending.lastIndexOf('\n');
            if(boundary<0)continue;
            controller.enqueue(encoder.encode(pending.slice(0,boundary+1)));
            pending=pending.slice(boundary+1);return;
          }
        }catch(e){controller.error(e);}
      },
      cancel:reason=>reader.cancel(reason),
    });
    return new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});
  };
}
