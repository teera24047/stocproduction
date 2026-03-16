import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [products, setProducts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [usersList, setUsersList] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [form, setForm] = useState({ productId: '', type: 'WITHDRAW', amount: '' })
  const [newProductForm, setNewProductForm] = useState({ name: '', serialNumber: '', assetNumber: '', quantity: '' })
  const [newUserForm, setNewUserForm] = useState({ employeeId: '', fullName: '', department: '', username: '', password: '', role: 'user' })

  // ฟังก์ชันดึงข้อมูลทั้งหมด
  const fetchData = async () => {
    try {
      const prodRes = await axios.get('http://localhost:8000/products')
      setProducts(prodRes.data)
      const txRes = await axios.get('http://localhost:8000/transactions')
      setTransactions(txRes.data)
      
      // ถ้าเป็น admin ให้ดึงรายชื่อพนักงานมาด้วย
      if (user && user.role === 'admin') {
        const userRes = await axios.get('http://localhost:8000/users')
        setUsersList(userRes.data)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    }
  }

  // 🌟 [ส่วนที่แก้ไข] ระบบ Auto-Refresh (Polling) 🌟
  useEffect(() => {
    if (user) {
      fetchData(); // ดึงข้อมูลทันทีเมื่อล็อกอินสำเร็จ
      
      // ตั้งเวลาให้ดึงข้อมูลใหม่ทุกๆ 3 วินาที (3000 มิลลิวินาที)
      const intervalId = setInterval(() => {
        fetchData();
      }, 3000);

      // เคลียร์การตั้งเวลาเมื่อผู้ใช้ออกจากระบบหรือปิดหน้าเว็บ
      return () => clearInterval(intervalId);
    }
  }, [user])
  // 🌟 ==================================== 🌟

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const response = await axios.post('http://localhost:8000/login', loginForm)
      setUser(response.data.user)
    } catch (error) {
      alert("❌ " + (error.response?.data?.detail || "Error"))
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    try {
      await axios.post('http://localhost:8000/users', {
        employee_id: newUserForm.employeeId,
        full_name: newUserForm.fullName,
        department: newUserForm.department,
        username: newUserForm.username,
        password: newUserForm.password,
        role: newUserForm.role
      })
      alert("✅ สร้างผู้ใช้ใหม่สำเร็จ!")
      fetchData()
      setNewUserForm({ employeeId: '', fullName: '', department: '', username: '', password: '', role: 'user' })
    } catch (error) {
      alert("❌ " + (error.response?.data?.detail || error.message))
    }
  }

  const handleToggleUserStatus = async (userId, currentStatus) => {
    if (!window.confirm(`ยืนยันการ ${currentStatus ? 'ระงับสิทธิ์' : 'ปลดระงับ'} พนักงานคนนี้?`)) return;
    try {
      await axios.put(`http://localhost:8000/users/${userId}/status`, { is_active: !currentStatus })
      alert("✅ อัปเดตสถานะสำเร็จ")
      fetchData()
    } catch (error) {
      alert("❌ " + (error.response?.data?.detail || error.message))
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("คำเตือน: ยืนยันการลบผู้ใช้งานอย่างถาวร? (หากเคยทำรายการ แนะนำให้ใช้ปุ่ม 'ระงับสิทธิ์' แทน)")) return;
    try {
      await axios.delete(`http://localhost:8000/users/${userId}`)
      alert("✅ ลบพนักงานสำเร็จ")
      fetchData()
    } catch (error) {
      alert("❌ " + (error.response?.data?.detail || error.message))
    }
  }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    try {
      await axios.post('http://localhost:8000/products', {
        name: newProductForm.name,
        serial_number: newProductForm.serialNumber || "-",
        asset_number: newProductForm.assetNumber || "-",
        quantity: parseInt(newProductForm.quantity) || 0
      })
      alert("✅ เพิ่มสินค้าใหม่สำเร็จ!")
      fetchData()
      setNewProductForm({ name: '', serialNumber: '', assetNumber: '', quantity: '' }) 
    } catch (error) {
      alert("Error: " + error.message)
    }
  }

  const handleTransaction = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post('http://localhost:8000/transactions', {
        product_id: parseInt(form.productId),
        transaction_type: form.type,
        amount: parseInt(form.amount),
        user_id: user.user_id,
        role: user.role
      })
      alert(res.data.message || "✅ ทำรายการสำเร็จ (ตัดสต็อกแล้ว)!")
      fetchData()
      setForm({ ...form, amount: '' })
    } catch (error) {
      alert("❌ " + (error.response?.data?.detail || error.message))
    }
  }

  const handleApproval = async (txId, status) => {
    if (!window.confirm(`ยืนยันการ ${status === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ'} คำขอนี้?`)) return;
    try {
      await axios.put(`http://localhost:8000/transactions/${txId}/status`, { status })
      // ไม่ต้อง alert ตลอดแล้วก็ได้ครับ เพราะหน้าเว็บจะอัปเดตเองแล้ว
      fetchData()
    } catch (error) {
      alert("❌ " + (error.response?.data?.detail || error.message))
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.product_id.toString().includes(searchQuery)
  )

  const displayTransactions = user?.role === 'admin' 
    ? transactions 
    : transactions.filter(t => t.user_id === user?.user_id)

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5' }}>
        <div className="card" style={{ width: '350px', textAlign: 'center', padding: '30px' }}>
          <h2 style={{ color: '#1877f2' }}>Inventory Login</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ textAlign: 'left' }}><label>Username</label><input type="text" className="form-control" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} required /></div>
            <div className="form-group" style={{ textAlign: 'left' }}><label>Password</label><input type="password" className="form-control" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} required /></div>
            <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>เข้าสู่ระบบ</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="navbar" style={{ justifyContent: 'space-between' }}>
        <h1>Inventory System</h1>
        <div>
          <span style={{ marginRight: '15px', fontWeight: 'bold' }}>
            👤 {user.full_name} [{user.employee_id}] ({user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'})
          </span>
          <button onClick={() => {setUser(null); setLoginForm({username:'', password:''})}} style={{ padding: '8px 15px', background: '#e4e6eb', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '1400px' }}>
        
        <div className="left-panel">
          {user.role === 'admin' && (
            <>
              <div className="card">
                <h3>👥 เพิ่มพนักงานเข้าระบบ</h3>
                <form onSubmit={handleCreateUser}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <input type="text" className="form-control" placeholder="รหัสพนักงาน" value={newUserForm.employeeId} onChange={e => setNewUserForm({...newUserForm, employeeId: e.target.value})} required />
                    <input type="text" className="form-control" placeholder="ชื่อ - นามสกุล" value={newUserForm.fullName} onChange={e => setNewUserForm({...newUserForm, fullName: e.target.value})} required />
                  </div>
                  <div className="form-group"><input type="text" className="form-control" placeholder="แผนก" value={newUserForm.department} onChange={e => setNewUserForm({...newUserForm, department: e.target.value})} required /></div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <input type="text" className="form-control" placeholder="Username" value={newUserForm.username} onChange={e => setNewUserForm({...newUserForm, username: e.target.value})} required />
                    <input type="password" className="form-control" placeholder="Password" value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <select className="form-control" value={newUserForm.role} onChange={e => setNewUserForm({...newUserForm, role: e.target.value})}>
                      <option value="user">พนักงาน (ต้องรออนุมัติ)</option>
                      <option value="admin">ผู้ดูแลระบบ (อนุมัติได้)</option>
                    </select>
                  </div>
                  <button type="submit" className="btn-primary" style={{ backgroundColor: '#2b2b2b' }}>บันทึกพนักงานใหม่</button>
                </form>
              </div>

              <div className="card">
                <h3>➕ เพิ่มสินค้าใหม่เข้าคลัง</h3>
                <form onSubmit={handleAddProduct}>
                  <div className="form-group"><input type="text" className="form-control" placeholder="ชื่อสินค้า" value={newProductForm.name} onChange={e => setNewProductForm({...newProductForm, name: e.target.value})} required /></div>
                  <div className="form-group"><input type="number" className="form-control" placeholder="จำนวนเริ่มต้น" value={newProductForm.quantity} onChange={e => setNewProductForm({...newProductForm, quantity: e.target.value})} required min="0" /></div>
                  <button type="submit" className="btn-primary" style={{ backgroundColor: '#42b72a' }}>บันทึกสินค้าใหม่</button>
                </form>
              </div>
            </>
          )}

          <div className="card">
            <h3>🔄 ขอทำรายการ {user.role === 'user' ? '(รอแอดมินอนุมัติ)' : '(ตัดสต็อกทันที)'}</h3>
            <form onSubmit={handleTransaction}>
              <div className="form-group"><input type="number" className="form-control" placeholder="รหัสสินค้า" value={form.productId} onChange={e => setForm({...form, productId: e.target.value})} required /></div>
              <div className="form-group">
                <select className="form-control" value={form.type} onChange={e => setForm({...form, type: e.target.value})} disabled={user.role === 'user'}>
                  <option value="WITHDRAW">📦 เบิกออก (Withdraw)</option>
                  {user.role === 'admin' && <option value="INBOUND">📥 รับเข้าเพิ่ม (Inbound)</option>}
                </select>
              </div>
              <div className="form-group"><input type="number" className="form-control" placeholder="จำนวน" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required min="1" /></div>
              <button type="submit" className="btn-primary">ยืนยันการทำรายการ</button>
            </form>
          </div>
        </div>

        <div className="right-panel">
          
          {user.role === 'admin' && (
            <div className="card" style={{ overflowX: 'auto', marginBottom: '20px', borderLeft: '4px solid #1877f2' }}>
              <h3 style={{ color: '#1877f2' }}>👥 จัดการรายชื่อพนักงาน</h3>
              <table className="table" style={{ fontSize: '14px' }}>
                <thead>
                  <tr>
                    <th>รหัส</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th>แผนก</th>
                    <th>Username</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.user_id} style={{ opacity: u.is_active ? 1 : 0.5 }}>
                      <td>{u.employee_id}</td>
                      <td>{u.full_name}</td>
                      <td>{u.department}</td>
                      <td>{u.username}</td>
                      <td>
                        {u.is_active 
                          ? <span style={{ color: 'green', fontWeight: 'bold' }}>ปกติ</span> 
                          : <span style={{ color: 'red', fontWeight: 'bold' }}>ระงับสิทธิ์</span>}
                      </td>
                      <td>
                        {u.username !== 'admin' && (
                          <>
                            <button onClick={() => handleToggleUserStatus(u.user_id, u.is_active)} style={{ background: u.is_active ? '#e69900' : '#42b72a', color: 'white', border: 'none', padding: '5px 8px', marginRight: '5px', cursor: 'pointer', borderRadius: '4px' }}>
                              {u.is_active ? 'ระงับ' : 'ปลดระงับ'}
                            </button>
                            <button onClick={() => handleDeleteUser(u.user_id)} style={{ background: 'red', color: 'white', border: 'none', padding: '5px 8px', cursor: 'pointer', borderRadius: '4px' }}>ลบ</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card" style={{ overflowX: 'auto', marginBottom: '20px', backgroundColor: '#fff9e6' }}>
            <h3 style={{ color: '#b08d00' }}>📋 ประวัติคำขอเบิก & ทำรายการ</h3>
            <table className="table" style={{ fontSize: '14px' }}>
              <thead>
                <tr>
                  <th>รหัสคำขอ</th>
                  <th>ผู้ทำรายการ</th>
                  <th>สินค้า</th>
                  <th>จำนวน</th>
                  <th>สถานะ</th>
                  {user.role === 'admin' && <th>การอนุมัติ (ตัดสต็อก)</th>}
                </tr>
              </thead>
              <tbody>
                {displayTransactions.map(tx => (
                  <tr key={tx.transaction_id}>
                    <td>#{tx.transaction_id}</td>
                    <td>{tx.full_name} [{tx.employee_id}]</td>
                    <td>{tx.product_name}</td>
                    <td>{tx.transaction_type === 'INBOUND' ? '+' : '-'}{tx.amount}</td>
                    <td>
                      {tx.status === 'PENDING' && <span style={{ color: 'orange', fontWeight: 'bold' }}>รออนุมัติ</span>}
                      {tx.status === 'APPROVED' && <span style={{ color: 'green', fontWeight: 'bold' }}>อนุมัติ/สำเร็จ</span>}
                      {tx.status === 'REJECTED' && <span style={{ color: 'red', fontWeight: 'bold' }}>ไม่อนุมัติ</span>}
                    </td>
                    {user.role === 'admin' && (
                      <td>
                        {tx.status === 'PENDING' ? (
                          <>
                            <button onClick={() => handleApproval(tx.transaction_id, 'APPROVED')} style={{ background: 'green', color: 'white', border: 'none', padding: '5px 10px', marginRight: '5px', cursor: 'pointer', borderRadius: '4px' }}>✓ อนุมัติ</button>
                            <button onClick={() => handleApproval(tx.transaction_id, 'REJECTED')} style={{ background: 'red', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '4px' }}>✗ ปฏิเสธ</button>
                          </>
                        ) : "-"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>📦 ข้อมูลสต็อกปัจจุบัน</h3>
              <input type="text" className="form-control" placeholder="🔍 ค้นหาสินค้า..." style={{ width: '200px' }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <table className="table">
              <thead>
                <tr><th>รหัส</th><th>ชื่อสินค้า</th><th>คงเหลือ</th></tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.product_id}>
                    <td><strong>#{p.product_id}</strong></td>
                    <td>{p.name}</td>
                    <td style={{ color: p.quantity <= 5 ? 'red' : 'green', fontWeight: 'bold' }}>{p.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  )
}

export default App