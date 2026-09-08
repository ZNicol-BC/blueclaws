
(function(){
  function close(){ var b=document.getElementById("patchNotesBackdrop"); if(b) b.classList.remove("show"); }
  document.addEventListener("click", function(e){
    if (e.target && e.target.id === "patchNotesClose") close();
    if (e.target && e.target.id === "patchNotesBackdrop") close();
  });
  document.addEventListener("keydown", function(e){ if (e.key === "Escape") close(); });
})();

