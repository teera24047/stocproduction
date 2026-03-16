# --- สคริปต์อัปเดตระบบอัตโนมัติ ---

# 1. Build Backend Image ใหม่
echo "🏗️ Building Backend..."
docker build -t stocproduction-backend:latest ./backend

# 2. Build Frontend Image ใหม่
echo "🏗️ Building Frontend..."
docker build -t stocproduction-frontend:latest ./inventory-frontend

# 3. สั่งให้ K8s รีโหลด Deployment ใหม่
# (K8s จะเห็นว่า Image มีการเปลี่ยนแปลง และจะดึงตัวล่าสุดไปรัน)
echo "🚀 Updating Kubernetes Deployments..."
kubectl rollout restart deployment stocproduction-api
kubectl rollout restart deployment stocproduction-frontend

# 4. เช็คสถานะ
echo "⏳ Waiting for pods to restart..."
kubectl get pods -w