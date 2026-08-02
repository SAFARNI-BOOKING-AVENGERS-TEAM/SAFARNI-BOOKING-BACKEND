document.getElementById("loginBtn").addEventListener("click", login);

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (res.ok) {
    document.getElementById("status").innerText = "Logged in! Connecting socket...";
    connectSocket();
  } else {
    document.getElementById("status").innerText = "Login failed";
  }
}

function connectSocket() {
  const socket = io({ withCredentials: true });

  socket.on("connect", () => {
    document.getElementById("status").innerText = "Connected! Waiting for notifications...";
  });

  socket.on("notification", (data) => {
    const li = document.createElement("li");
    li.innerText = `[${data.type}] ${data.title}: ${data.message}`;
    document.getElementById("notifications").prepend(li);
  });

  socket.on("connect_error", (err) => {
    document.getElementById("status").innerText = "Connection failed: " + err.message;
  });
}