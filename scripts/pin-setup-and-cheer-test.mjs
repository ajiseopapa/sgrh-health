// 처음 PIN 정하기 + 응원 직원 기준 집계 시험 — 시험 DB 전용. PIN 없는 시험 직원(정민준)이 있어야 합니다.
//   LOG=<운동 기록 id> PIN=<S001 시험 PIN> node scripts/pin-setup-and-cheer-test.mjs
const H='http://localhost:3576'
function client(){let ck='';return async(p,o={})=>{const r=await fetch(H+p,{method:o.method||'GET',headers:{'x-sgrh-request':'1','Content-Type':'application/json',Origin:H,cookie:ck},body:o.body?JSON.stringify(o.body):undefined});for(const c of r.headers.getSetCookie?.()||[]){const kv=c.split(';')[0];if(!kv.endsWith('='))ck=(ck?ck+'; ':'')+kv;else ck=''}return{status:r.status,...(await r.json().catch(()=>({})))}}}
let pass=0,fail=0;const check=(n,c,x='')=>{c?(pass++,console.log('  ✅',n)):(fail++,console.log('  ❌',n,x))}
const a=client(), b=client(), anon=client()
const emps=(await anon('/api/employees')).employees
const nu=emps.find(e=>e.name==='정민준'), s1=emps.find(e=>e.employee_number==='S001')
console.log('— 처음 PIN 정하기')
check('PIN 없는 직원: hasPin false',(await anon('/api/auth/setup-pin?id='+nu.id)).hasPin===false)
check('PIN 있는 직원: hasPin true',(await anon('/api/auth/setup-pin?id='+s1.id)).hasPin===true)
check('쉬운 번호 거절',(await a('/api/auth/setup-pin',{method:'POST',body:{employeeId:nu.id,newPin:'123456'}})).status===400)
check('사번과 같은 번호 거절 또는 형식 오류',[400].includes((await a('/api/auth/setup-pin',{method:'POST',body:{employeeId:nu.id,newPin:'111111'}})).status))
check('5자리 거절',(await a('/api/auth/setup-pin',{method:'POST',body:{employeeId:nu.id,newPin:'12345'}})).status===400)
check('이미 PIN 있는 직원(S001)에 설정 시도 409',(await a('/api/auth/setup-pin',{method:'POST',body:{employeeId:s1.id,newPin:'482915'}})).status===409)
check('그 뒤에도 S001 원래 PIN으로 로그인됨',(await b('/api/auth/login',{method:'POST',body:{employeeId:s1.id,pin:process.env.PIN}})).status===200)
check('없는 직원 404',(await a('/api/auth/setup-pin',{method:'POST',body:{employeeId:'00000000-0000-4000-8000-000000000000',newPin:'482915'}})).status===404)
const rs=await Promise.all([client(),client(),client()].map(c=>c('/api/auth/setup-pin',{method:'POST',body:{employeeId:nu.id,newPin:'482915'}})))
check('동시에 3번 정해도 1번만 성공',rs.filter(r=>r.status===200).length===1&&rs.filter(r=>r.status===409).length===2,rs.map(r=>r.status).join(','))
const c2=client(); const lg=await c2('/api/auth/login',{method:'POST',body:{employeeId:nu.id,pin:'482915'}})
check('정한 PIN으로 로그인 · 임시 PIN 아님',lg.status===200&&lg.mustChangePin===false)
const me=await c2('/api/auth/me'); check('본인으로 확인됨',me.me?.id===nu.id&&me.mustChangePin===false)
const g=await c2('/api/me/game'); check('캐릭터 아직 안 고름(null) → 고르기 창 대상',g.status===200&&g.characterKey===null,JSON.stringify(g).slice(0,80))
check('다시 설정 시도 409',(await anon('/api/auth/setup-pin',{method:'POST',body:{employeeId:nu.id,newPin:'593716'}})).status===409)
console.log('— 응원: 직원 기준')
const L=process.env.LOG
const dev=()=>'t-'+Math.random().toString(36).slice(2)+'-'+Date.now()
const dPC=dev(), dPhone=dev(), dAnon=dev()
const cnt=async(c,d)=>{const r=await c('/api/reactions/summary',{method:'POST',body:{logIds:[L],deviceId:d}});const x=(r.cheers||[]).find(v=>v.emoji==='👏');return{count:x?.count??0,mine:!!x?.mine}}
const base=(await cnt(anon,dAnon)).count
// 같은 직원이 PC, 폰 두 기기에서 로그인
const pc=client(), ph=client()
await pc('/api/auth/login',{method:'POST',body:{employeeId:nu.id,pin:'482915'}}); await ph('/api/auth/login',{method:'POST',body:{employeeId:nu.id,pin:'482915'}})
let r=await pc('/api/reactions',{method:'POST',body:{logId:L,deviceId:dPC,emoji:'👏',on:true}})
check('PC에서 응원 → +1',r.status===200&&r.count===base+1,JSON.stringify(r))
check('폰에서 열면 이미 누른 것으로 보임',(await cnt(ph,dPhone)).mine===true)
r=await ph('/api/reactions',{method:'POST',body:{logId:L,deviceId:dPhone,emoji:'👏',on:true}})
check('폰에서 또 눌러도 그대로 +1(중복 없음)',r.count===base+1,JSON.stringify(r))
r=await ph('/api/reactions',{method:'POST',body:{logId:L,deviceId:dPhone,emoji:'👏',on:false}})
check('폰에서 끄면 PC에서도 꺼짐',r.count===base&&(await cnt(pc,dPC)).mine===false)
// 본인 확인 전에 기기로 눌러 둔 응원 → 로그인 후 직원 기준으로 합쳐짐
const d1=dev(), d2=dev()
await anon('/api/reactions',{method:'POST',body:{logId:L,deviceId:d1,emoji:'👏',on:true}})
await anon('/api/reactions',{method:'POST',body:{logId:L,deviceId:d2,emoji:'👏',on:true}})
check('로그인 전: 기기 2대 = 2',(await cnt(anon,dAnon)).count===base+2)
await cnt(pc,d1); const after=await cnt(ph,d2)
check('두 기기에서 로그인해 피드를 열면 1로 합쳐짐',after.count===base+1&&after.mine===true,JSON.stringify(after))
await pc('/api/reactions',{method:'POST',body:{logId:L,deviceId:d1,emoji:'👏',on:false}})
check('정리 후 원래 수',(await cnt(anon,dAnon)).count===base)
// 다른 직원은 따로 셈
const o=client(); await o('/api/auth/login',{method:'POST',body:{employeeId:s1.id,pin:process.env.PIN}})
await pc('/api/reactions',{method:'POST',body:{logId:L,deviceId:dPC,emoji:'👏',on:true}})
r=await o('/api/reactions',{method:'POST',body:{logId:L,deviceId:dev(),emoji:'👏',on:true}})
check('다른 직원이 누르면 +2',r.count===base+2)
await pc('/api/reactions',{method:'POST',body:{logId:L,deviceId:dPC,emoji:'👏',on:false}}); await o('/api/reactions',{method:'POST',body:{logId:L,deviceId:dev(),emoji:'👏',on:false}})
check('모두 끄면 원래 수',(await cnt(anon,dAnon)).count===base)
console.log(`
결과: ${pass} 통과 / ${fail} 실패`)
