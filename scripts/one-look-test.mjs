// 옷 한 벌·꾸미기는 운동복에서만(11-20 TK) 시험 — 시험 DB 전용. dev 서버가 떠 있어야 합니다.
//   PIN=<S001 시험 PIN> node scripts/one-look-test.mjs
//   S001 이 top_nurse·top_greenhoodie·bottom_grayshorts·hat_hairband 를 가지고 있어야 함(시험 DB에서 넣어 둠)
const H = 'http://localhost:3576'
function client(){let ck='';return async(p,o={})=>{const r=await fetch(H+p,{method:o.method||'GET',headers:{'x-sgrh-request':'1','Content-Type':'application/json',Origin:H,cookie:ck},body:o.body?JSON.stringify(o.body):undefined});for(const c of r.headers.getSetCookie?.()||[]){const kv=c.split(';')[0];if(!kv.endsWith('='))ck=(ck?ck+'; ':'')+kv}return{status:r.status,...(await r.json().catch(()=>({})))}}}
let pass=0,fail=0;const check=(n,c,x='')=>{c?(pass++,console.log('  ✅',n)):(fail++,console.log('  ❌',n,x))}
const me=client(), anon=client()
const s=(await anon('/api/employees')).employees.find(e=>e.employee_number==='S001')
await me('/api/auth/login',{method:'POST',body:{employeeId:s.id,pin:process.env.PIN}})
const wear=(slot,item)=>me('/api/me/game/equip',{method:'PUT',body:{slot,item}})
const eq=async()=>(await me('/api/me/game')).character.equipped
const before=await eq()
// 꾸미기 하나 입혀 두고 시작
await wear('hat','hat_hairband')
let r=await wear('top','top_nurse'); check('유니폼(간호복) 입기 200',r.status===200&&r.game.character.equipped.top==='top_nurse',JSON.stringify(r).slice(0,150))
check('옷을 입어도 꾸미기 기록은 남음',r.game.character.equipped.hat==='hat_hairband')
r=await wear('bottom','bottom_grayshorts'); let e=r.game.character.equipped
check('하의를 입으면 유니폼(상의 칸)은 벗음',e.bottom==='bottom_grayshorts'&&!e.top,JSON.stringify(e))
r=await wear('top','top_greenhoodie'); e=r.game.character.equipped
check('상의를 입으면 하의는 벗음(옷 한 벌)',e.top==='top_greenhoodie'&&!e.bottom&&!e.shoes,JSON.stringify(e))
r=await wear('hat','hat_hairband'); e=r.game.character.equipped
check('운동복 계열 옷(초록 후드)에는 꾸미기를 같이 입음',e.top==='top_greenhoodie'&&e.hat==='hat_hairband',JSON.stringify(e))
r=await wear('top','top_nurse'); r=await wear('hat','hat_hairband'); e=r.game.character.equipped
check('유니폼 입은 채 꾸미기를 입으면 유니폼만 벗음',!e.top&&e.hat==='hat_hairband',JSON.stringify(e))
r=await wear('top','top_nurse'); r=await wear('top',null); e=r.game.character.equipped
check('옷 벗기(운동복으로) 200',r.status===200&&!e.top)
check('안 산 유니폼 입기 403',(await wear('top','top_office')).status===403)
check('유니폼을 다른 칸에 400',(await wear('bottom','top_nurse')).status===400)
const p=(await anon('/api/game/profile?id='+s.id)).profile
check('동료 프로필 정상',!!p&&p.equipped?.hat==='hat_hairband',JSON.stringify(p?.equipped))
// 원래대로
for(const sl of ['top','bottom','shoes','hat','face','hair','back','hand','effect']) if((before[sl]??null)!==(e[sl]??null)) await wear(sl,before[sl]??null)
console.log(`\n${pass} 통과, ${fail} 실패`); process.exit(fail?1:0)
