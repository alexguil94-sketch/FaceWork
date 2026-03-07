(function(){
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-nav]");
  const navLinks = nav ? nav.querySelectorAll("a") : [];
  const revealNodes = document.querySelectorAll("[data-reveal]");
  const yearNode = document.getElementById("year");
  const form = document.getElementById("contact-form");
  const copyButton = document.querySelector("[data-copy-email]");
  const toast = document.querySelector(".toast");
  const modal = document.querySelector("[data-image-modal]");
  const modalImage = document.getElementById("image-modal-image");
  const modalTriggers = document.querySelectorAll("[data-modal-trigger]");
  const modalCloseNodes = document.querySelectorAll("[data-modal-close]");
  const guestOnlyNodes = document.querySelectorAll("[data-guest-only]");
  const sessionOnlyNodes = document.querySelectorAll("[data-session-only]");

  if(yearNode){
    yearNode.textContent = String(new Date().getFullYear());
  }

  function showToast(message){
    if(window.fwToast){
      window.fwToast("Site", message);
      return;
    }
    if(!toast) return;
    const title = toast.querySelector(".t");
    const detail = toast.querySelector(".d");
    if(title) title.textContent = "Site";
    if(detail) detail.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timerId);
    showToast.timerId = window.setTimeout(function(){
      toast.classList.remove("show");
    }, 2600);
  }

  function setMenu(open){
    if(!menuToggle || !nav) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  }

  function syncSessionCtas(){
    const user = window.fw?.getUser?.() || null;
    const isAuthed = !!user;

    guestOnlyNodes.forEach((node)=>{
      node.classList.toggle("hidden", isAuthed);
    });

    sessionOnlyNodes.forEach((node)=>{
      node.classList.toggle("hidden", !isAuthed);
    });
  }

  function closeModal(){
    if(!modal) return;
    modal.hidden = true;
    document.body.classList.remove("has-modal-open");
    if(modalImage){
      modalImage.removeAttribute("src");
      modalImage.alt = "";
    }
  }

  function openModal(trigger){
    if(!modal || !modalImage || !trigger) return;
    const src = trigger.getAttribute("data-modal-image");
    const alt = trigger.getAttribute("data-modal-alt") || "";
    if(!src) return;
    modalImage.src = src;
    modalImage.alt = alt;
    modal.hidden = false;
    document.body.classList.add("has-modal-open");
  }

  if(menuToggle && nav){
    menuToggle.addEventListener("click", function(){
      const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
      setMenu(!isOpen);
    });

    navLinks.forEach(function(link){
      link.addEventListener("click", function(){
        setMenu(false);
      });
    });

    window.addEventListener("resize", function(){
      if(window.innerWidth > 760){
        setMenu(false);
      }
    });

    document.addEventListener("click", function(event){
      const target = event.target;
      if(!nav.contains(target) && !menuToggle.contains(target)){
        setMenu(false);
      }
    });
  }

  if(modal && modalImage){
    modalTriggers.forEach(function(trigger){
      trigger.addEventListener("click", function(){
        openModal(trigger);
      });
    });

    modalCloseNodes.forEach(function(node){
      node.addEventListener("click", closeModal);
    });
  }

  document.addEventListener("keydown", function(event){
    if(event.key !== "Escape") return;
    setMenu(false);
    closeModal();
  });

  if("IntersectionObserver" in window){
    const observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16 });

    revealNodes.forEach(function(node){
      observer.observe(node);
    });
  }else{
    revealNodes.forEach(function(node){
      node.classList.add("is-visible");
    });
  }

  if(form){
    form.addEventListener("submit", function(event){
      event.preventDefault();

      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const email = String(data.get("email") || "").trim();
      const project = String(data.get("project") || "").trim();
      const message = String(data.get("message") || "").trim();

      if(!name || !email || !message){
        showToast("Nom, email et message sont requis.");
        return;
      }

      const to = form.getAttribute("data-mail") || "alexguil94@hotmail.fr";
      const subject = project ? `Projet - ${project}` : "Demande depuis le site";
      const body = [
        `Nom: ${name}`,
        `Email: ${email}`,
        project ? `Projet: ${project}` : null,
        "",
        message,
      ].filter(Boolean).join("\n");

      window.location.href =
        `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      showToast("Ouverture de la messagerie.");
    });
  }

  if(copyButton){
    copyButton.addEventListener("click", function(){
      const to = form ? form.getAttribute("data-mail") || "alexguil94@hotmail.fr" : "alexguil94@hotmail.fr";
      if(!navigator.clipboard || !navigator.clipboard.writeText){
        showToast(`Copie indisponible. Adresse: ${to}`);
        return;
      }

      navigator.clipboard.writeText(to)
        .then(function(){
          showToast("Adresse email copiee.");
        })
        .catch(function(){
          showToast(`Copie impossible. Adresse: ${to}`);
        });
    });
  }

  window.addEventListener("load", syncSessionCtas);
  window.addEventListener("storage", syncSessionCtas);
  window.setTimeout(syncSessionCtas, 250);
  window.setTimeout(syncSessionCtas, 1200);

  syncSessionCtas();
})();
