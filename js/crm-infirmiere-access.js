(function () {
  "use strict";

  const body = document.body;
  const api = window.fwSupabase || {};
  const titleElement = document.querySelector("[data-care-access-title]");
  const messageElement = document.querySelector("[data-care-access-message]");
  const actionsElement = document.querySelector("[data-care-access-actions]");

  function redirectToLogin() {
    const destination = encodeURIComponent("app/crm-infirmiere.html");
    window.location.replace("../login.html?next=" + destination);
  }

  function showRefused(title, message) {
    body.classList.remove("access-pending");
    body.classList.add("access-denied");
    if (titleElement) titleElement.textContent = title;
    if (messageElement) messageElement.textContent = message;
    actionsElement?.classList.remove("hidden");
  }

  function initials(name) {
    return String(name || "Utilisateur")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .join("") || "U";
  }

  function fillUser(profile, isAdmin) {
    const name = String(profile?.name || "Utilisateur");
    document.querySelector("[data-care-user-initials]").textContent = initials(name);
    document.querySelector("[data-care-user-name]").textContent = name;
    document.querySelector("[data-care-user-role]").textContent = isAdmin ? "Administrateur" : "Accès SereinCare";
  }

  function loadApplication() {
    const script = document.createElement("script");
    script.src = "../js/crm-infirmiere.js";
    script.defer = true;
    document.body.appendChild(script);
  }

  async function hasCarePermission(client, profile, userId) {
    const memberRoles = await client
      .from("member_roles")
      .select("role_id")
      .eq("company", profile.company)
      .eq("user_id", userId);

    if (memberRoles.error) {
      throw memberRoles.error;
    }

    const roleIds = (memberRoles.data || [])
      .map(function (item) {
        return String(item.role_id || "");
      })
      .filter(Boolean);

    if (!roleIds.length) return false;

    const roles = await client
      .from("roles")
      .select("id,perms")
      .eq("company", profile.company)
      .in("id", roleIds);

    if (roles.error) {
      throw roles.error;
    }

    return (roles.data || []).some(function (role) {
      return role?.perms?.admin === true || role?.perms?.nurseCrm === true;
    });
  }

  async function authorize() {
    if (!api.enabled || !api.client || typeof api.getSession !== "function") {
      showRefused(
        "Accès privé indisponible",
        "La connexion sécurisée FaceWork doit être configurée pour ouvrir SereinCare."
      );
      return;
    }

    const session = await api.getSession();
    if (!session?.user) {
      redirectToLogin();
      return;
    }

    await api.syncLocalUser?.();
    const profile = await api.fetchProfile(session.user.id);
    if (!profile) {
      showRefused("Profil introuvable", "Reconnectez-vous ou contactez l'administrateur FaceWork.");
      return;
    }

    const isAdmin = String(profile.role || "").trim().toLowerCase() === "admin";
    let allowed = isAdmin;
    if (!allowed) {
      allowed = await hasCarePermission(api.client, profile, session.user.id);
    }

    if (!allowed) {
      showRefused(
        "Accès SereinCare non attribué",
        "Votre compte est connecté, mais l'administrateur ne vous a pas encore donné le rôle Accès SereinCare."
      );
      return;
    }

    fillUser(profile, isAdmin);
    body.classList.remove("access-pending", "access-denied");
    body.classList.add("access-granted");
    loadApplication();
  }

  authorize().catch(function (error) {
    console.error("[SereinCare access]", error);
    showRefused(
      "Vérification impossible",
      "Une erreur empêche de vérifier votre accès privé pour le moment."
    );
  });
}());
