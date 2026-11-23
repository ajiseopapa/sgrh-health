// 캐릭터 꾸미기 아이템 시험 — 시험 DB 전용. dev 서버가 떠 있어야 합니다.
//   PIN=<S001 시험 PIN> node scripts/wear-test.mjs <before|after>   (before = 036 실행 전, after = 실행 후)
const H = 'http://localhost:3576'
function client(){let ck='';return async(p,o={})=>{const r=await fetch(H+p,{method:o.method||'GET',headers:{'x-sgrh-request':'1','Content-Type':'application/json',Origin:H,cookie:ck},body:o.body?JSON.stringify(o.body):undefined});for(const c of r.headers.getSetCookie?.()||[]){const kv=c.split(';')[0];if(!kv.endsWith('='))ck=(ck?ck+'; ':'')+kv}return{status:r.status,...(await r.json().catch(()=>({})))}}}
let pass=0,fail=0;const check=(n,c,x='')=>{c?(pass++,console.log('  ✅',n)):(fail++,console.log('  ❌',n,x))}
const phase=process.argv[2]||'after'
const me=client(), anon=client()
const s=(await anon('/api/employees')).employees.find(e=>e.employee_number==='S001')
await me('/api/auth/login',{method:'POST',body:{employeeId:s.id,pin:process.env.PIN}})
const buy=k=>me('/api/me/game/purchase',{method:'POST',body:{item:k}})
const wear=(slot,item)=>me('/api/me/game/equip',{method:'PUT',body:{slot,item}})
let g=await me('/api/me/game')
check('내 정보 정상',g.status===200)
console.log('  잔액',g.sunlight.balance,'가진 아이템',g.character.owned)
check('없는 아이템 구매 400',(await buy('hat_nothing')).status===400)
check('예전 이모지 아이템 구매 400',(await buy('hat_cap')).status===400)
check('로그인 없이 입기 401',(await anon('/api/me/game/equip',{method:'PUT',body:{slot:'hat',item:'hat_hairband'}})).status===401)
check('없는 칸 400',(await wear('wings','hat_hairband')).status===400)
check('칸이 다른 아이템 400',(await wear('face','hat_hairband')).status===400)
if(!g.character.owned.includes('hat_hairband')&&g.sunlight.balance<30){console.log('  (햇빛 부족 — 시험 DB에 운동 기록을 더 넣어야 함)')}
for(const k of ['hat_hairband','face_glasses']) if(!g.character.owned.includes(k)){const r=await buy(k); check(`${k} 구매`,r.status===200,JSON.stringify(r).slice(0,120))}
g=await me('/api/me/game')
check('안 산 아이템 입기 403',g.character.owned.includes('effect_crown')||(await wear('effect','effect_crown')).status===403)
let r=await wear('hat','hat_hairband'); check('모자 칸(예전부터 있던 칸) 입기 200',r.status===200&&r.game.character.equipped.hat==='hat_hairband',JSON.stringify(r).slice(0,150))
r=await wear('face','face_glasses')
if(phase==='before') check('036 전: 새 칸(안경) 입기 503 안내',r.status===503,JSON.stringify(r).slice(0,120))
else {
  check('안경 칸 입기 200',r.status===200&&r.game.character.equipped.face==='face_glasses')
  const p=(await anon('/api/game/profile?id='+s.id)).profile
  check('동료 프로필에 입은 아이템 나감',p.equipped?.hat==='hat_hairband'&&p.equipped?.face==='face_glasses',JSON.stringify(p.equipped))
  check('동료 프로필에 가진 목록·햇빛은 안 나감',!/owned|balance|sunlight/.test(JSON.stringify(p)))
  r=await wear('face',null); check('벗기',r.status===200&&!r.game.character.equipped.face)
  r=await wear('face',null); check('이미 벗은 것 또 벗어도 200',r.status===200)
}
r=await wear('hat',null); check('모자 벗기',r.status===200&&!r.game.character.equipped.hat)
check('산 기록은 그대로',(await me('/api/me/game')).character.owned.includes('hat_hairband'))
console.log(`결과(${phase}): ${pass} 통과 / ${fail} 실패`)
