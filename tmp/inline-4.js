/* index214: options render from CATEGORY_ORDER at boot so this list and the
           contract section order can never drift apart again */
        document.addEventListener("DOMContentLoaded", function(){
          try { document.getElementById("assetContractSection").innerHTML = '<option value="">Choose section</option>' + CATEGORY_ORDER.map(function(c){ return '<option>' + c.replace(/&/g, "&amp;") + '</option>'; }).join(""); } catch(e) {}
        });
