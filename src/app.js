import { createClient } from "@supabase/supabase-js";
import { appConfig } from "./config.js";

const supabaseClient = createClient(
  appConfig.supabaseUrl,
  appConfig.supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

const loginForm = document.querySelector("#login-form");
const loginEmail = document.querySelector("#login-email");
const loginSubmit = document.querySelector("#login-submit");
const userPanel = document.querySelector("#user-panel");
const userEmail = document.querySelector("#user-email");
const logoutButton = document.querySelector("#logout-button");
const authMessage = document.querySelector("#auth-message");
const receiptEditor = document.querySelector("#receipt-editor");
const openProjectDialog = document.querySelector("#open-project-dialog");
const closeProjectDialog = document.querySelector("#close-project-dialog");
const projectDialog = document.querySelector("#project-dialog");
const projectForm = document.querySelector("#project-form");
const projectName = document.querySelector("#project-name");
const projectDescription = document.querySelector("#project-description");
const projectSubmit = document.querySelector("#project-submit");
const projectFormMessage = document.querySelector("#project-form-message");
const todayDate = document.querySelector("#today-date");
const photoUpload = document.querySelector("#photo-upload");
const photoPreview = document.querySelector("#photo-preview");
const photoPlaceholder = document.querySelector("#photo-placeholder");
const photoRemove = document.querySelector("#photo-remove");
const receiptProject = document.querySelector("#receipt-project");
const projectSubtitle = document.querySelector("#project-subtitle");
const receiptTitle = document.querySelector("#receipt-title");
const receiptSubtitle = document.querySelector("#receipt-subtitle");
const receiptNote = document.querySelector("#receipt-note");
const downloadReceipt = document.querySelector("#download-receipt");
let currentUser = null;
let projects = [];
let previewUrl = "";
let turnstileWidgetId = null;
let turnstileToken = "";
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const day = String(now.getDate()).padStart(2, "0");

todayDate.value = `${year}-${month}-${day}`;

const setMessage = (element, message, type = "info") => {
  if (!message) {
    element.textContent = "";
    element.classList.add("hidden");
    return;
  }

  element.textContent = message;
  element.className = `mt-3 rounded-[8px] px-3 py-2 text-sm leading-6 ${
    type === "error"
      ? "bg-rose-50 text-rose-700"
      : type === "success"
        ? "bg-emerald-50 text-emerald-800"
        : "bg-sky-50 text-sky-800"
  }`;
};

const getRedirectUrl = () => `${window.location.origin}${window.location.pathname}`;

const getLoginCooldownKey = () => "what-i-learned-receipt:login-cooldown";

const getRemainingLoginCooldown = () => {
  const cooldownUntil = Number(localStorage.getItem(getLoginCooldownKey()) || 0);
  return Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
};

const resetTurnstile = () => {
  turnstileToken = "";
  if (turnstileWidgetId !== null && window.turnstile) {
    window.turnstile.reset(turnstileWidgetId);
  }
};

const renderTurnstile = () => {
  if (!window.turnstile || turnstileWidgetId !== null) {
    return;
  }

  turnstileWidgetId = window.turnstile.render("#turnstile-container", {
    sitekey: appConfig.turnstileSiteKey,
    theme: "light",
    action: "magic_link_login",
    callback: (token) => {
      turnstileToken = token;
      setMessage(authMessage, "");
    },
    "expired-callback": () => {
      turnstileToken = "";
    },
    "error-callback": () => {
      turnstileToken = "";
      setMessage(authMessage, "자동 로그인 시도 방지 확인을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", "error");
    },
  });
};

const waitForTurnstile = () => {
  if (window.turnstile) {
    renderTurnstile();
    return;
  }
  window.setTimeout(waitForTurnstile, 100);
};

const getRecentProjectKey = () => currentUser
  ? `what-i-learned-receipt:last-project:${currentUser.id}`
  : "";

const getSelectedProject = () => {
  return projects.find((project) => project.id === receiptProject.value) || null;
};

const updateProjectDetails = () => {
  const selectedProject = getSelectedProject();
  const subtitle = selectedProject?.subtitle?.trim();

  projectSubtitle.textContent = subtitle || "";
  projectSubtitle.classList.toggle("hidden", !subtitle);
  downloadReceipt.disabled = !selectedProject;
  downloadReceipt.classList.toggle("opacity-50", !selectedProject);
  downloadReceipt.classList.toggle("cursor-not-allowed", !selectedProject);

  if (selectedProject && currentUser) {
    localStorage.setItem(getRecentProjectKey(), selectedProject.id);
  }
};

const renderProjects = () => {
  const recentProjectId = localStorage.getItem(getRecentProjectKey());
  receiptProject.replaceChildren();

  if (!projects.length) {
    const option = new Option("먼저 프로젝트를 만들어주세요.", "");
    receiptProject.add(option);
    receiptProject.disabled = true;
    updateProjectDetails();
    if (!projectDialog.open) {
      projectDialog.showModal();
    }
    projectName.focus();
    return;
  }

  for (const project of projects) {
    receiptProject.add(new Option(project.name, project.id));
  }

  receiptProject.disabled = false;
  receiptProject.value = projects.some((project) => project.id === recentProjectId)
    ? recentProjectId
    : projects[0].id;
  updateProjectDetails();
};

const loadProjects = async () => {
  receiptProject.disabled = true;
  receiptProject.replaceChildren(new Option("프로젝트를 불러오는 중...", ""));

  const { data, error } = await supabaseClient
    .from("projects")
    .select("id, name, subtitle, updated_at")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    projects = [];
    receiptProject.replaceChildren(new Option("프로젝트를 불러오지 못했습니다.", ""));
    setMessage(authMessage, "프로젝트를 불러오지 못했습니다. 데이터베이스 설정을 확인해주세요.", "error");
    return;
  }

  projects = data;
  renderProjects();
};

const renderSession = async (user) => {
  currentUser = user;
  setMessage(authMessage, "");

  if (!user) {
    projects = [];
    loginForm.classList.remove("hidden");
    userPanel.classList.add("hidden");
    userPanel.classList.remove("flex");
    receiptEditor.classList.add("hidden");
    userEmail.textContent = "";
    return;
  }

  loginForm.classList.add("hidden");
  userPanel.classList.remove("hidden");
  userPanel.classList.add("flex");
  receiptEditor.classList.remove("hidden");
  userEmail.textContent = user.email || "로그인 사용자";
  await loadProjects();
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const remainingCooldown = getRemainingLoginCooldown();

  if (remainingCooldown > 0) {
    setMessage(authMessage, `잠시 후 다시 시도해주세요. (${remainingCooldown}초)`, "error");
    return;
  }

  if (!turnstileToken) {
    setMessage(authMessage, "자동 로그인 시도 방지 확인을 완료해주세요.", "error");
    return;
  }

  loginSubmit.disabled = true;
  loginSubmit.textContent = "로그인 링크 보내는 중...";
  setMessage(authMessage, "");

  const captchaToken = turnstileToken;
  turnstileToken = "";
  const { error } = await supabaseClient.auth.signInWithOtp({
    email: loginEmail.value.trim(),
    options: {
      emailRedirectTo: getRedirectUrl(),
      captchaToken,
      shouldCreateUser: true,
    },
  });

  if (error) {
    setMessage(authMessage, "로그인 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.", "error");
  } else {
    localStorage.setItem(
      getLoginCooldownKey(),
      String(Date.now() + appConfig.loginCooldownSeconds * 1000),
    );
    setMessage(authMessage, "이메일을 확인해주세요. 받은 로그인 링크를 누르면 이 화면으로 돌아옵니다.", "success");
    loginForm.reset();
  }

  resetTurnstile();
  loginSubmit.disabled = false;
  loginSubmit.textContent = "이메일로 로그인";
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    setMessage(authMessage, "로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.", "error");
  }

  logoutButton.disabled = false;
});

openProjectDialog.addEventListener("click", () => {
  setMessage(projectFormMessage, "");
  if (!projectDialog.open) {
    projectDialog.showModal();
  }
  projectName.focus();
});

closeProjectDialog.addEventListener("click", () => {
  if (projects.length) {
    projectDialog.close();
  }
});

projectDialog.addEventListener("cancel", (event) => {
  if (!projects.length) {
    event.preventDefault();
  }
});

projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  projectSubmit.disabled = true;
  projectSubmit.textContent = "프로젝트 만드는 중...";
  setMessage(projectFormMessage, "");

  const name = projectName.value.trim();
  const subtitle = projectDescription.value.trim();
  const { data, error } = await supabaseClient
    .from("projects")
    .insert({
      owner_id: currentUser.id,
      name,
      subtitle: subtitle || null,
    })
    .select("id, name, subtitle, updated_at")
    .single();

  if (error) {
    setMessage(projectFormMessage, "프로젝트를 만들지 못했습니다. 입력값을 확인하고 다시 시도해주세요.", "error");
  } else {
    projects = [data, ...projects];
    projectForm.reset();
    projectDialog.close();
    renderProjects();
    receiptProject.value = data.id;
    updateProjectDetails();
  }

  projectSubmit.disabled = false;
  projectSubmit.textContent = "프로젝트 만들기";
});

receiptProject.addEventListener("change", updateProjectDetails);

supabaseClient.auth.onAuthStateChange((_event, session) => {
  window.setTimeout(() => renderSession(session?.user || null), 0);
});

supabaseClient.auth.getSession().then(({ data, error }) => {
  if (error) {
    setMessage(authMessage, "로그인 상태를 확인하지 못했습니다. 페이지를 새로고침해주세요.", "error");
    return;
  }

  renderSession(data.session?.user || null);
});

photoUpload.addEventListener("change", () => {
  const file = photoUpload.files[0];

  if (!file) {
    return;
  }

  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
  const maxPhotoBytes = 10 * 1024 * 1024;
  if (!allowedTypes.has(file.type) || file.size > maxPhotoBytes) {
    photoUpload.value = "";
    setMessage(authMessage, "사진은 JPG, PNG, WebP 또는 HEIC 형식의 10MB 이하 파일만 사용할 수 있습니다.", "error");
    return;
  }

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  previewUrl = URL.createObjectURL(file);
  photoPreview.src = previewUrl;
  photoPreview.classList.remove("hidden");
  photoPlaceholder.classList.add("hidden");
  photoRemove.classList.remove("hidden");
});

waitForTurnstile();

photoRemove.addEventListener("click", () => {
  photoUpload.value = "";
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = "";
  }
  photoPreview.removeAttribute("src");
  photoPreview.classList.add("hidden");
  photoPlaceholder.classList.remove("hidden");
  photoRemove.classList.add("hidden");
});

const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
};

const drawRoundRect = (context, x, y, width, height, radius) => {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
};

const drawContainImage = (context, image, x, y, width, height) => {
  const imageRatio = image.width / image.height;
  const boxRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let drawX = x;
  let drawY = y;

  if (imageRatio > boxRatio) {
    drawHeight = width / imageRatio;
    drawY = y + (height - drawHeight) / 2;
  } else {
    drawWidth = height * imageRatio;
    drawX = x + (width - drawWidth) / 2;
  }

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
};

const wrapText = (context, text, x, y, maxWidth, lineHeight, maxLines) => {
  const paragraphs = text.split("\n");
  let lineCount = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ");
    let line = "";

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;

      if (context.measureText(testLine).width > maxWidth && line) {
        context.fillText(line, x, y);
        y += lineHeight;
        lineCount += 1;
        line = word;
      } else {
        line = testLine;
      }

      if (lineCount >= maxLines) {
        return y;
      }
    }

    if (lineCount < maxLines) {
      context.fillText(line, x, y);
      y += lineHeight;
      lineCount += 1;
    }
  }

  return y;
};

const canvasToBlob = (canvas) => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to create receipt image."));
      }
    }, "image/png");
  });
};

const isIOSDevice = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
};

const downloadImage = (canvas, fileName) => {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png");
  link.click();
};

downloadReceipt.addEventListener("click", async () => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const width = 900;
  const height = 1560;
  const padding = 72;
  const project = getSelectedProject()?.name || "나의 학습 프로젝트";
  const title = receiptTitle.value.trim() || "오늘의 학습 기록";
  const subtitle = receiptSubtitle.value.trim();
  const note = receiptNote.value.trim() || "오늘 배운 내용을 짧게 남겨보세요.";

  canvas.width = width;
  canvas.height = height;

  context.fillStyle = "#f6efe3";
  context.fillRect(0, 0, width, height);

  context.shadowColor = "rgba(53, 46, 38, 0.22)";
  context.shadowBlur = 48;
  context.shadowOffsetY = 24;
  context.fillStyle = "#fffaf1";
  drawRoundRect(context, 54, 54, width - 108, height - 108, 18);
  context.fill();
  context.shadowColor = "transparent";

  context.fillStyle = "#f97316";
  drawRoundRect(context, 54, 150, 12, 82, 6);
  context.fill();

  context.fillStyle = "#44403c";
  context.font = "700 24px Pretendard, Arial, sans-serif";
  context.fillText("LEARNING RECEIPT", padding, 130);

  context.fillStyle = "#be123c";
  drawRoundRect(context, 696, 92, 108, 42, 21);
  context.fill();
  context.fillStyle = "#fff1f2";
  context.font = "800 20px Pretendard, Arial, sans-serif";
  context.fillText("TODAY", 718, 120);

  context.strokeStyle = "#d6d3d1";
  context.setLineDash([12, 12]);
  context.beginPath();
  context.moveTo(padding, 178);
  context.lineTo(width - padding, 178);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = "#78716c";
  context.font = "700 22px Pretendard, Arial, sans-serif";
  context.fillText("PROJECT", padding, 230);
  context.fillStyle = "#1c1917";
  context.font = "900 34px Pretendard, Arial, sans-serif";
  wrapText(context, project, padding, 274, 470, 42, 1);

  context.fillStyle = "#78716c";
  context.font = "700 22px Pretendard, Arial, sans-serif";
  context.textAlign = "right";
  context.fillText("DATE", width - padding, 230);
  context.fillStyle = "#1c1917";
  context.font = "900 28px Pretendard, Arial, sans-serif";
  context.fillText(todayDate.value, width - padding, 274);
  context.textAlign = "left";

  context.fillStyle = "#1c1917";
  context.font = "900 54px Pretendard, Arial, sans-serif";
  const titleEndY = wrapText(context, title, padding, 370, width - padding * 2, 68, 2);

  let contentEndY = titleEndY;

  if (subtitle) {
    context.fillStyle = "#78716c";
    context.font = "600 27px Pretendard, Arial, sans-serif";
    contentEndY = wrapText(
      context,
      subtitle,
      padding,
      titleEndY + 6,
      width - padding * 2,
      38,
      2,
    );
  }

  const imageBoxY = contentEndY + 34;
  const imageBoxHeight = 390;
  context.save();
  drawRoundRect(context, padding, imageBoxY, width - padding * 2, imageBoxHeight, 18);
  context.fillStyle = "#ffffff";
  context.fill();
  context.clip();

  if (previewUrl) {
    const image = await loadImage(previewUrl);
    drawContainImage(context, image, padding, imageBoxY, width - padding * 2, imageBoxHeight);
  } else {
    context.fillStyle = "#ffedd5";
    context.fillRect(padding, imageBoxY, width - padding * 2, imageBoxHeight);
    context.fillStyle = "#9a3412";
    context.font = "800 34px Pretendard, Arial, sans-serif";
    context.textAlign = "center";
    context.fillText("사진 없이 발행한 기록", width / 2, imageBoxY + imageBoxHeight / 2 + 12);
    context.textAlign = "left";
  }

  context.restore();

  context.strokeStyle = "#e7e5e4";
  context.lineWidth = 2;
  drawRoundRect(context, padding, imageBoxY, width - padding * 2, imageBoxHeight, 18);
  context.stroke();

  const noteLabelY = imageBoxY + imageBoxHeight + 72;
  const noteBoxY = noteLabelY + 28;
  const noteBoxHeight = 220;

  context.fillStyle = "#1c1917";
  context.font = "800 30px Pretendard, Arial, sans-serif";
  context.fillText("오늘 배운 것", padding, noteLabelY);

  context.fillStyle = "#ffffff";
  drawRoundRect(context, padding, noteBoxY, width - padding * 2, noteBoxHeight, 14);
  context.fill();

  context.strokeStyle = "#e7e5e4";
  context.lineWidth = 2;
  drawRoundRect(context, padding, noteBoxY, width - padding * 2, noteBoxHeight, 14);
  context.stroke();

  context.fillStyle = "#57534e";
  context.font = "500 28px Pretendard, Arial, sans-serif";
  wrapText(context, note, padding + 28, noteBoxY + 48, width - padding * 2 - 56, 42, 4);

  const footerLineY = noteBoxY + noteBoxHeight + 52;
  context.strokeStyle = "#d6d3d1";
  context.setLineDash([12, 12]);
  context.beginPath();
  context.moveTo(padding, footerLineY);
  context.lineTo(width - padding, footerLineY);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = "#2563eb";
  context.font = "900 24px Pretendard, Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("what-i-learned-receipt", width / 2, footerLineY + 62);
  context.textAlign = "left";

  const fileName = `learning-receipt-${todayDate.value}.png`;

  if (isIOSDevice()) {
    try {
      const blob = await canvasToBlob(canvas);
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
        });
        return;
      }
    } catch (error) {
      console.warn("Image sharing is unavailable.", error);
    }
  }

  downloadImage(canvas, fileName);
});
