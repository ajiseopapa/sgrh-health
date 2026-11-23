const H='http://localhost:3576'
function client(){let ck='';return async(p,o={})=>{const r=await fetch(H+p,{method:o.method||'GET',headers:{'x-sgrh-request':'1','Content-Type':'application/json',Origin:H,cookie:ck},body:o.body?JSON.stringify(o.body):undefined});for(const c of r.headers.getSetCookie?.()||[]){const kv=c.split(';')[0];if(!kv.endsWith('='))ck=(ck?ck+'; ':'')+kv}return{status:r.status,...(await r.json().catch(()=>({})))}}}
let pass=0,fail=0;const check=(n,c,x='')=>{c?(pass++,console.log('  ✅',n)):(fail++,console.log('  ❌',n,x))}
const me=client(), anon=client(); const phase=process.argv[2]
const s=(await anon('/api/employees')).employees.find(e=>e.employee_number==='S001')
await me('/api/auth/login',{method:'POST',body:{employeeId:s.id,pin:process.env.PIN}})
const put=b=>me('/api/me/game/profile',{method:'PUT',body:b})
if(phase==='before'){
  const g=await me('/api/me/game'); check('035 전: 내 정보 정상 · 의상 null',g.status===200&&g.outfitKey===null)
  check('035 전: 의상 저장 503 안내',(await put({outfit:'nurse'})).status===503)
  check('035 전: 캐릭터 저장은 그대로 됨',(await put({character:'m'})).status===200)
  check('035 전: 동료 프로필 정상',(await anon('/api/game/profile?id='+s.id)).status===200)
}else{
  check('없는 의상 400',(await put({outfit:'pirate'})).status===400)
  check('숫자 400',(await put({outfit:5})).status===400)
  check('로그인 없이 401',(await anon('/api/me/game/profile',{method:'PUT',body:{outfit:'nurse'}})).status===401)
  const r=await put({outfit:'nurse'}); check('간호복 저장 200',r.status===200&&r.outfit==='nurse',JSON.stringify(r))
  let g=await me('/api/me/game'); check('내 정보에 반영',g.outfitKey==='nurse'&&g.characterKey==='m')
  let p=(await anon('/api/game/profile?id='+s.id)).profile; check('동료에게도 보임',p.outfit==='nurse')
  await put({character:'f'}); g=await me('/api/me/game'); check('캐릭터를 바꿔도 의상 유지',g.outfitKey==='nurse'&&g.characterKey==='f')
  await put({outfit:'workout'}); await put({character:'m'}); g=await me('/api/me/game'); check('운동복으로 되돌림',g.outfitKey==='workout')
  const fs=await import('node:fs'); let miss=0; for(const c of ['m','f']) for(const o of ['workout','nurse','doctor','office','hoodie','scrub','glasses','vest']){const x=await fetch(`${H}/game/v22/characters/char-${c}-${o}.png`); if(x.status!==200) miss++}
  check('의상 그림 16장 모두 열림',miss===0,String(miss))
}
console.log(`결과(${phase}): ${pass} 통과 / ${fail} 실패`)
