const modal=document.querySelector('#modal');
document.querySelector('#askAI').onclick=()=>modal.showModal();
document.querySelector('#viewPlaybook').onclick=()=>modal.showModal();
document.querySelector('#closeModal').onclick=()=>modal.close();
document.querySelectorAll('.filter').forEach(f=>f.onclick=()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));f.classList.add('active')});
document.querySelector('#explainBtn').onclick=e=>{e.target.textContent='✓ Query uses date partition + customer index';e.target.classList.add('confirmed')};
