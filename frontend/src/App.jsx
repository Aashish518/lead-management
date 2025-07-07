import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  setDoc
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Search, PlusCircle, Users, BarChart2, Inbox, Trash2, X, Phone, Mail, Building, User, Info, FileText, Printer, Settings, Package, Edit2, Upload, Share2, AtSign, Link2 } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : {
    apiKey: "AIzaSyBfQDN6rv-z5boPhDurEWTSOUb6VCXe1uo",
    authDomain: "lead-management-c7d7b.firebaseapp.com",
    projectId: "lead-management-c7d7b",
    storageBucket: "lead-management-c7d7b.firebasestorage.app",
    messagingSenderId: "214977986937",
    appId: "1:214977986937:web:74252564791214e85eafa8",
    measurementId: "G-GHPQVHK80Z"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-lead-app';

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Helper to get a user ID ---
const getUserId = () => auth.currentUser?.uid || 'anonymous_user';

// --- Firestore Collection Paths ---
const leadsCollectionPath = `/artifacts/${appId}/public/data/leads`;
const quotationsCollectionPath = `/artifacts/${appId}/public/data/quotations`;
const inventoryCollectionPath = `/artifacts/${appId}/public/data/inventory`;
const settingsDocPath = `/artifacts/${appId}/public/data/settings/companyInfo`;

// --- Constants ---
const LEAD_STATUSES = ['New', 'Contacted', 'Call not picked', 'Interested', 'Visit booked', 'Not interested', 'Quotation request', 'Negotiation', 'Pending Payment', 'Lost'];
const CURRENCIES = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

// --- Main App Component ---
export default function App() {
  const [publicQuoteData, setPublicQuoteData] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // Check for public quote data in URL hash
    const hash = window.location.hash;
    if (hash.startsWith('#/quote/')) {
      try {
        const encodedData = hash.substring(8);
        const decodedJson = atob(encodedData);
        const data = JSON.parse(decodedJson);
        setPublicQuoteData(data);
      } catch (e) {
        console.error("Failed to parse public quote data:", e);
        // If parsing fails, proceed to normal auth flow
        initializeAuth();
      }
    } else {
      initializeAuth();
    }
  }, []);

  const initializeAuth = () => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error("Auth Error:", error); }
    };
    const unsub = onAuthStateChanged(auth, user => user ? setIsAuthReady(true) : initAuth());
    return () => unsub();
  };

  if (publicQuoteData) {
    return <PublicQuotationView data={publicQuoteData} />;
  }

  if (!isAuthReady) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div></div>;
  return <LeadManagementPanel />;
}

// --- Lead Management Panel Component ---
function LeadManagementPanel() {
  const [leads, setLeads] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [companyInfo, setCompanyInfo] = useState({});
  const [view, setView] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(query(collection(db, leadsCollectionPath)), s => setLeads(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, quotationsCollectionPath)), s => setQuotations(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, inventoryCollectionPath)), s => setInventory(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(doc(db, settingsDocPath), s => setCompanyInfo(s.exists() ? s.data() : {}))
    ];
    setIsLoading(false);
    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200 font-sans">
      <Sidebar setView={setView} currentView={view} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-900 p-4 sm:p-6 lg:p-8">
          {isLoading ? <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div></div> : (
            <>
              {view === 'dashboard' && <Dashboard leads={leads} />}
              {view === 'leads' && <LeadTable leads={leads} />}
              {view === 'quotations' && <QuotationManager quotations={quotations} leads={leads} companyInfo={companyInfo} inventory={inventory} />}
              {view === 'inventory' && <InventoryManager inventory={inventory} />}
              {view === 'settings' && <SettingsManager companyInfo={companyInfo} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// --- UI Components (Sidebar, Header, etc.) ---
function Sidebar({ setView, currentView }) {
  const NavItem = ({ icon, text, viewName }) => (
    <button onClick={() => setView(viewName)} className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${currentView === viewName ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
      {icon}
      <span className="ml-3">{text}</span>
    </button>
  );
  return (
    <aside className="w-64 flex-shrink-0 bg-gray-800 p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center mb-8"><Users className="h-8 w-8 text-blue-500" /><h1 className="ml-3 text-xl font-bold text-white">LeadPanel</h1></div>
        <nav className="space-y-2">
          <NavItem icon={<BarChart2 size={20} />} text="Dashboard" viewName="dashboard" />
          <NavItem icon={<Inbox size={20} />} text="All Leads" viewName="leads" />
          <NavItem icon={<FileText size={20} />} text="Quotations" viewName="quotations" />
          <NavItem icon={<Package size={20} />} text="Inventory" viewName="inventory" />
          <NavItem icon={<Settings size={20} />} text="Settings" viewName="settings" />
        </nav>
      </div>
      <div className="text-xs text-gray-500"><p>User ID: <span className="font-mono text-gray-400 break-all">{getUserId()}</span></p><p className="mt-1">App ID: <span className="font-mono text-gray-400">{appId}</span></p></div>
    </aside>
  );
}
function Header() {
  return (
    <header className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        <h2 className="text-lg font-semibold text-white">Welcome, Admin!</h2>
        <div className="relative"><img className="h-10 w-10 rounded-full" src={auth.currentUser?.photoURL || `https://i.pravatar.cc/150?u=${getUserId()}`} alt="Avatar" /><span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-gray-800"></span></div>
      </div>
    </header>
  );
}

// --- Dashboard & Lead Management ---
function Dashboard({ leads }) {
  const stats = useMemo(() => ({
    totalLeads: leads.length,
    newLeads: leads.filter(l => l.status === 'New').length,
    interested: leads.filter(l => l.status === 'Interested').length,
    pendingPayment: leads.filter(l => l.status === 'Pending Payment').length,
  }), [leads]);

  const chartData = useMemo(() => {
    const statusCounts = leads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(statusCounts).map(status => ({ name: status, count: statusCounts[status] }));
  }, [leads]);

  const StatCard = ({ title, value, icon }) => (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-400 font-medium">{title}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
      </div>
      <div className="bg-blue-600 p-3 rounded-full">{icon}</div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Leads" value={stats.totalLeads} icon={<Users size={24} className="text-white" />} />
        <StatCard title="New Leads" value={stats.newLeads} icon={<Inbox size={24} className="text-white" />} />
        <StatCard title="Interested" value={stats.interested} icon={<User size={24} className="text-white" />} />
        <StatCard title="Pending Payment" value={stats.pendingPayment} icon={<Phone size={24} className="text-white" />} />
      </div>
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Lead Status Distribution</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
              <XAxis dataKey="name" stroke="#a0aec0" angle={-15} textAnchor="end" height={60} interval={0} />
              <YAxis stroke="#a0aec0" />
              <Tooltip contentStyle={{ backgroundColor: '#2d3748', border: '1px solid #4a5568' }} />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
function LeadTable({ leads }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const filteredLeads = useMemo(() =>
    leads.filter(lead =>
      (lead.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (lead.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (lead.company?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ), [leads, searchTerm]);

  const handleRowClick = (lead) => {
    setSelectedLead(lead);
    setDetailModalOpen(true);
  };

  const handleUpdateStatus = async (leadId, newStatus) => {
    const leadRef = doc(db, leadsCollectionPath, leadId);
    try { await updateDoc(leadRef, { status: newStatus }); } catch (error) { console.error("Error updating status:", error); }
  };

  const handleDeleteLead = async (leadId) => {
    try {
      await deleteDoc(doc(db, leadsCollectionPath, leadId));
      setDetailModalOpen(false);
    } catch (error) { console.error("Error deleting lead:", error); }
  };

  const StatusBadge = ({ status }) => {
    const colorMap = {
      'New': 'bg-blue-500', 'Contacted': 'bg-yellow-500', 'Call not picked': 'bg-orange-500',
      'Interested': 'bg-cyan-500', 'Visit booked': 'bg-purple-500', 'Not interested': 'bg-gray-500',
      'Quotation request': 'bg-indigo-500', 'Negotiation': 'bg-pink-500', 'Pending Payment': 'bg-green-500',
      'Lost': 'bg-red-500',
    };
    return <span className={`px-2 py-1 text-xs font-semibold text-white rounded-full ${colorMap[status] || 'bg-gray-600'}`}>{status}</span>;
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" placeholder="Search leads..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-64 bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => setAddModalOpen(true)} className="flex items-center justify-center w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200">
          <PlusCircle size={20} className="mr-2" /> Add New Lead
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs text-gray-300 uppercase bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3">Name</th><th scope="col" className="px-6 py-3">Company</th><th scope="col" className="px-6 py-3">Email & Phone</th><th scope="col" className="px-6 py-3">Status</th><th scope="col" className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map(lead => (
              <tr key={lead.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer" onClick={() => handleRowClick(lead)}>
                <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{lead.name}</td>
                <td className="px-6 py-4">{lead.company}</td>
                <td className="px-6 py-4"><div>{lead.email}</div><div className="text-gray-500">{lead.phone}</div></td>
                <td className="px-6 py-4"><StatusBadge status={lead.status} /></td>
                <td className="px-6 py-4">
                  <select value={lead.status} onChange={(e) => handleUpdateStatus(lead.id, e.target.value)} onClick={(e) => e.stopPropagation()} className="bg-gray-600 border border-gray-500 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1.5">
                    {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isAddModalOpen && <AddLeadModal onClose={() => setAddModalOpen(false)} />}
      {isDetailModalOpen && selectedLead && <LeadDetailModal lead={selectedLead} onClose={() => setDetailModalOpen(false)} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteLead} />}
    </div>
  );
}
const InputField = ({ icon, ...props }) => (<div className="relative"><div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">{icon}</div><input {...props} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5" /></div>);
function AddLeadModal({ onClose }) {
  const [leadData, setLeadData] = useState({ name: '', email: '', phone: '', company: '', status: 'New', notes: '' });
  const handleChange = (e) => setLeadData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!leadData.name || !leadData.email) return;
    try {
      await addDoc(collection(db, leadsCollectionPath), { ...leadData, createdAt: new Date().toISOString(), assignedTo: getUserId() });
      onClose();
    } catch (error) { console.error("Error adding lead:", error); }
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-lg">
        <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-white">Add New Lead</h2><button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField icon={<User size={18} />} name="name" placeholder="Full Name" value={leadData.name} onChange={handleChange} required />
          <InputField icon={<Mail size={18} />} name="email" type="email" placeholder="Email Address" value={leadData.email} onChange={handleChange} required />
          <InputField icon={<Phone size={18} />} name="phone" type="tel" placeholder="Phone Number" value={leadData.phone} onChange={handleChange} />
          <InputField icon={<Building size={18} />} name="company" placeholder="Company Name" value={leadData.company} onChange={handleChange} />
          <div><label htmlFor="notes" className="block mb-2 text-sm font-medium text-gray-300">Notes</label><textarea id="notes" name="notes" rows="3" value={leadData.notes} onChange={handleChange} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="Add any relevant notes..."></textarea></div>
          <div className="flex justify-end space-x-4 pt-4"><button type="button" onClick={onClose} className="px-6 py-2 rounded-lg text-white bg-gray-600 hover:bg-gray-500 transition-colors">Cancel</button><button type="submit" className="px-6 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors">Add Lead</button></div>
        </form>
      </div>
    </div>
  );
}
function LeadDetailModal({ lead, onClose, onUpdateStatus, onDelete }) {
  const DetailItem = ({ icon, label, value }) => (<div className="flex items-start py-3"><div className="text-blue-400 mt-1">{icon}</div><div className="ml-4"><p className="text-sm text-gray-400">{label}</p><p className="text-base text-white">{value || 'N/A'}</p></div></div>);
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"><div className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-2xl flex flex-col"><div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-white flex items-center"><User className="mr-3" /> Lead Details</h2><button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button></div><div className="flex-grow overflow-y-auto pr-2 -mr-2"><div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4"><DetailItem icon={<User size={20} />} label="Name" value={lead.name} /><DetailItem icon={<Building size={20} />} label="Company" value={lead.company} /><DetailItem icon={<Mail size={20} />} label="Email" value={lead.email} /><DetailItem icon={<Phone size={20} />} label="Phone" value={lead.phone} /><div className="flex items-center py-3"><div className="text-blue-400"><Info size={20} /></div><div className="ml-4"><p className="text-sm text-gray-400">Status</p><select value={lead.status} onChange={(e) => onUpdateStatus(lead.id, e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 mt-1">{LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div></div><DetailItem icon={<Info size={20} />} label="Created At" value={new Date(lead.createdAt).toLocaleString()} /></div><div className="mt-4"><p className="text-sm text-gray-400 mb-2">Notes</p><div className="bg-gray-900/50 p-4 rounded-lg min-h-[80px] text-gray-300 whitespace-pre-wrap">{lead.notes || 'No notes added.'}</div></div></div><div className="flex justify-end space-x-4 pt-6 mt-auto"><button onClick={() => onDelete(lead.id)} className="flex items-center px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors"><Trash2 size={16} className="mr-2" /> Delete</button><button type="button" onClick={onClose} className="px-6 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors">Close</button></div></div></div>
  );
}

// --- Polymorphic Input Field ---
const SettingsInputField = ({ label, as: Component = 'input', ...props }) => (
  <div>
    <label className="block mb-2 text-sm font-medium text-gray-300">{label}</label>
    <Component {...props} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
  </div>
);

// --- Settings Manager ---
function SettingsManager({ companyInfo }) {
  const [info, setInfo] = useState({ name: '', address: '', gst: '', paymentTerms: '', logoBase64: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { if (companyInfo) setInfo(prev => ({ ...prev, ...companyInfo })); }, [companyInfo]);

  const handleChange = (e) => setInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size < 1048576) { // 1MB limit
      const reader = new FileReader();
      reader.onload = (loadEvent) => setInfo(prev => ({ ...prev, logoBase64: loadEvent.target.result }));
      reader.readAsDataURL(file);
    } else if (file) {
      alert("File is too large. Please select an image under 1MB.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, settingsDocPath), info, { merge: true });
    } catch (error) { console.error("Error saving settings:", error); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6 max-w-4xl mx-auto">
      <h3 className="text-2xl font-bold text-white mb-6">Company Settings</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <SettingsInputField label="Company Name" name="name" value={info.name || ''} onChange={handleChange} />
          <SettingsInputField label="GST Number" name="gst" value={info.gst || ''} onChange={handleChange} />
          <SettingsInputField label="Address" as="textarea" name="address" rows="4" value={info.address || ''} onChange={handleChange} />
          <SettingsInputField label="Default Payment Terms" as="textarea" name="paymentTerms" rows="4" value={info.paymentTerms || ''} onChange={handleChange} />
        </div>
        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-300">Company Logo</label>
            <div className="mt-2 flex items-center justify-center px-6 py-10 border-2 border-gray-600 border-dashed rounded-md">
              <div className="text-center">
                {info.logoBase64 ? <img src={info.logoBase64} alt="Logo Preview" className="mx-auto h-24 mb-4" /> : <Upload className="mx-auto h-12 w-12 text-gray-500" />}
                <div className="flex text-sm text-gray-400">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-gray-700 rounded-md font-medium text-blue-400 hover:text-blue-300 px-3 py-1">
                    <span>Upload a file</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 1MB</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed">
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// --- Inventory Manager ---
function InventoryManager({ inventory }) {
  const [isAddModalOpen, setAddModalOpen] = useState(false);

  const handleDelete = async (id) => {
    try { await deleteDoc(doc(db, inventoryCollectionPath, id)); } catch (error) { console.error("Error deleting inventory item:", error); }
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-white">Inventory / Services</h3>
        <button onClick={() => setAddModalOpen(true)} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700">
          <PlusCircle size={20} className="mr-2" /> Add Item
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs text-gray-300 uppercase bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3">Item/Service</th><th scope="col" className="px-6 py-3">SAC/HSN</th><th scope="col" className="px-6 py-3">Default Price</th><th scope="col" className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map(item => (
              <tr key={item.id} className="bg-gray-800 border-b border-gray-700">
                <td className="px-6 py-4 font-medium text-white">{item.name}</td>
                <td className="px-6 py-4">{item.sac}</td>
                <td className="px-6 py-4 font-mono">${(parseFloat(item.price) || 0).toFixed(2)}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-400"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isAddModalOpen && <AddInventoryItemModal onClose={() => setAddModalOpen(false)} />}
    </div>
  );
}
function AddInventoryItemModal({ onClose }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [sac, setSac] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !price) return;
    try {
      await addDoc(collection(db, inventoryCollectionPath), { name, price: parseFloat(price), sac });
      onClose();
    } catch (error) { console.error("Error adding inventory item:", error); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-lg">
        <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-white">Add Inventory Item</h2><button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SettingsInputField label="Item/Service Name" value={name} onChange={e => setName(e.target.value)} required />
          <SettingsInputField label="SAC/HSN Code" value={sac} onChange={e => setSac(e.target.value)} />
          <SettingsInputField label="Default Price" type="number" value={price} onChange={e => setPrice(e.target.value)} required />
          <div className="flex justify-end space-x-4 pt-4"><button type="button" onClick={onClose} className="px-6 py-2 rounded-lg text-white bg-gray-600 hover:bg-gray-500">Cancel</button><button type="submit" className="px-6 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700">Add Item</button></div>
        </form>
      </div>
    </div>
  );
}

// --- Share Helper ---
const handleShare = (platform, quotation, companyInfo) => {
  const currencySymbol = CURRENCIES[quotation.currency] || '$';
  const clientName = quotation.clientName;
  const quoteId = quotation.quotationId;
  const total = `${currencySymbol}${(parseFloat(quotation.total) || 0).toFixed(2)}`;
  const company = companyInfo.name;
  let text = `Hello ${clientName},\n\nHere is your quotation ${quoteId} for a total of ${total}.\n\nThank you,\n${company}`;

  if (platform === 'link') {
    const dataToEncode = { quotation, companyInfo };
    const encoded = btoa(JSON.stringify(dataToEncode));
    const url = `${window.location.origin}${window.location.pathname}#/quote/${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      alert("Shareable link copied to clipboard!");
    }, () => {
      alert("Failed to copy link.");
    });
    return;
  }

  if (platform === 'whatsapp') {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  } else if (platform === 'email') {
    const subject = `Quotation ${quoteId} from ${company}`;
    window.location.href = `mailto:${quotation.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  }
};

// --- Quotation Manager ---
function QuotationManager({ quotations, leads, companyInfo, inventory }) {
  const [modalState, setModalState] = useState({ isOpen: false, isEdit: false, data: null });
  const [detailModalState, setDetailModalState] = useState({ isOpen: false, data: null });

  const openModal = (isEdit = false, data = null) => setModalState({ isOpen: true, isEdit, data });
  const closeModal = () => setModalState({ isOpen: false, isEdit: false, data: null });

  const openDetailModal = (data) => setDetailModalState({ isOpen: true, data });
  const closeDetailModal = () => setDetailModalState({ isOpen: false, data: null });

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, quotationsCollectionPath, id));
      closeDetailModal();
    } catch (error) { console.error("Error deleting quotation:", error); }
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-white">Quotations</h3>
        <button onClick={() => openModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700">
          <PlusCircle size={20} className="mr-2" /> Create Quotation
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs text-gray-300 uppercase bg-gray-700">
            <tr>
              <th className="px-6 py-3">ID</th><th className="px-6 py-3">Client</th><th className="px-6 py-3">Date</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotations.map(q => (
              <tr key={q.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50">
                <td onClick={() => openDetailModal(q)} className="px-6 py-4 font-medium text-white cursor-pointer">{q.quotationId}</td>
                <td onClick={() => openDetailModal(q)} className="px-6 py-4 cursor-pointer">{q.clientName}</td>
                <td onClick={() => openDetailModal(q)} className="px-6 py-4 cursor-pointer">{new Date(q.date).toLocaleDateString()}</td>
                <td onClick={() => openDetailModal(q)} className="px-6 py-4 font-mono cursor-pointer">{(CURRENCIES[q.currency] || '$')}{(parseFloat(q.total) || 0).toFixed(2)}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleShare('whatsapp', q, companyInfo)} className="text-green-400 hover:text-green-300 mr-4" title="Share on WhatsApp"><Share2 size={16} /></button>
                  <button onClick={() => openModal(true, q)} className="text-blue-400 hover:text-blue-300 mr-4" title="Edit Quotation"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:text-red-400" title="Delete Quotation"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modalState.isOpen && <AddEditQuotationModal onClose={closeModal} isEdit={modalState.isEdit} initialData={modalState.data} leads={leads} quotations={quotations} inventory={inventory} companyInfo={companyInfo} />}
      {detailModalState.isOpen && <QuotationDetailModal quotation={detailModalState.data} onClose={closeDetailModal} onDelete={handleDelete} companyInfo={companyInfo} />}
    </div>
  );
}

// --- Add/Edit Quotation Modal ---
function AddEditQuotationModal({ onClose, isEdit, initialData, leads, quotations, inventory, companyInfo }) {
  const [formData, setFormData] = useState(initialData || {
    clientName: '', clientEmail: '', clientCompany: '', clientAddress: '', date: new Date().toISOString().split('T')[0],
    items: [{ description: '', sac: '', qty: 1, price: 0, taxRate: 0 }],
    currency: 'INR', cgstRate: 0, sgstRate: 0, igstRate: 0, leadId: ''
  });
  const [activeSearch, setActiveSearch] = useState(null);

  const handleLeadSelect = (e) => {
    const leadId = e.target.value;
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      setFormData(prev => ({
        ...prev,
        leadId: lead.id,
        clientName: lead.name || '',
        clientEmail: lead.email || '',
        clientCompany: lead.company || '',
      }));
    } else {
      setFormData(prev => ({ ...prev, leadId: '', clientName: '', clientEmail: '', clientCompany: '' }));
    }
  };

  const handleFormChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData(prev => ({ ...prev, items: newItems }));
    if (field === 'description') setActiveSearch(index);
  };
  const addItem = () => setFormData(prev => ({ ...prev, items: [...prev.items, { description: '', sac: '', qty: 1, price: 0, taxRate: 0 }] }));
  const removeItem = (index) => setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const handleInventorySelect = (index, invItem) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], description: invItem.name, price: invItem.price, sac: invItem.sac || '' };
    setFormData(prev => ({ ...prev, items: newItems }));
    setActiveSearch(null);
  };

  const filteredInventory = (index) => {
    if (activeSearch !== index || !formData.items[index]?.description) return [];
    return inventory.filter(item => item.name.toLowerCase().includes(formData.items[index].description.toLowerCase()));
  };

  const totals = useMemo(() => {
    const subtotal = formData.items.reduce((acc, item) => acc + (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0), 0);
    const itemTaxTotal = formData.items.reduce((acc, item) => {
      const itemTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
      return acc + (itemTotal * (parseFloat(item.taxRate) || 0) / 100);
    }, 0);
    const cgst = subtotal * (parseFloat(formData.cgstRate) || 0) / 100;
    const sgst = subtotal * (parseFloat(formData.sgstRate) || 0) / 100;
    const igst = subtotal * (parseFloat(formData.igstRate) || 0) / 100;
    const totalTax = itemTaxTotal + cgst + sgst + igst;
    const total = subtotal + totalTax;
    return { subtotal, totalTax, total, cgst, sgst, igst };
  }, [formData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataToSave = { ...formData, ...totals, paymentTerms: companyInfo.paymentTerms || '' };
    if (isEdit) {
      await updateDoc(doc(db, quotationsCollectionPath, initialData.id), dataToSave);
    } else {
      const newId = `QUO-${new Date().getFullYear()}-${(quotations.length + 1).toString().padStart(4, '0')}`;
      await addDoc(collection(db, quotationsCollectionPath), { ...dataToSave, quotationId: newId, createdAt: new Date().toISOString() });
    }
    onClose();
  };



  const TAX_RATES = [0, 5, 12, 18, 28];
  


  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-6xl max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold text-white mb-6 flex-shrink-0">{isEdit ? 'Edit' : 'Create'} Quotation</h2>
        <form id="quotation-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-4 -mr-4">
          {/* Client & Quote Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <SettingsInputField label="Select Client from Leads" as="select" value={formData.leadId} onChange={handleLeadSelect}>
              <option value="">-- Select a Lead --</option>
              {leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name} ({lead.company})</option>)}
            </SettingsInputField>
            <SettingsInputField label="Client Email" name="clientEmail" type="email" value={formData.clientEmail} onChange={handleFormChange} />
            <SettingsInputField label="Client Company" name="clientCompany" value={formData.clientCompany} onChange={handleFormChange} />
            <SettingsInputField label="Date" name="date" type="date" value={formData.date} onChange={handleFormChange} required />
          </div>
          {/* Items Table */}
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 font-bold px-2">
              <div className="col-span-4">Description</div><div className="col-span-2">SAC/HSN</div><div>Qty</div><div>Price</div><div>Tax %</div><div className="col-span-2 text-right">Total</div>
            </div>
            {formData.items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-4 relative">
                  <input type="text" placeholder="Item description" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} onFocus={() => setActiveSearch(index)} className="bg-gray-700 border-gray-600 text-white text-sm rounded-lg p-2 w-full" />
                  {activeSearch === index && filteredInventory(index).length > 0 && (
                    <div className="absolute z-10 w-full bg-gray-600 rounded-b-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredInventory(index).map(inv => (
                        <div key={inv.id} onClick={() => handleInventorySelect(index, inv)} className="p-2 text-white hover:bg-blue-600 cursor-pointer">{inv.name}</div>
                      ))}
                    </div>
                  )}
                </div>
                <input type="text" placeholder="SAC/HSN" value={item.sac} onChange={e => handleItemChange(index, 'sac', e.target.value)} className="col-span-2 bg-gray-700 border-gray-600 text-white text-sm rounded-lg p-2" />
                <input type="number" placeholder="Qty" value={item.qty} onChange={e => handleItemChange(index, 'qty', e.target.value)} className="bg-gray-700 border-gray-600 text-white text-sm rounded-lg p-2" />
                <input type="number" placeholder="Price" value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value)} className="bg-gray-700 border-gray-600 text-white text-sm rounded-lg p-2" />
                <input type="number" placeholder="Tax %" value={item.taxRate} onChange={e => handleItemChange(index, 'taxRate', e.target.value)} className="bg-gray-700 border-gray-600 text-white text-sm rounded-lg p-2" />
                <div className="col-span-2 text-right font-mono text-white p-2">${(parseFloat(item.qty || 0) * parseFloat(item.price || 0)).toFixed(2)}</div>
                <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-400"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="text-blue-400 hover:text-blue-300 text-sm mt-4">+ Add Item</button>
          {/* Totals & Taxes */}
          <div className="flex justify-between mt-6">
            <div className="grid grid-cols-4 gap-4">
              

              <SettingsInputField
                label="Currency"
                as="select"
                name="currency"
                value={formData.currency}
                onChange={handleFormChange}
              >
                {Object.keys(CURRENCIES).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SettingsInputField>

              <SettingsInputField
                label="CGST (%)"
                as="select"
                name="cgstRate"
                value={formData.cgstRate}
                onChange={handleFormChange}
              >
                {TAX_RATES.map(rate => (
                  <option key={rate} value={rate}>{rate}%</option>
                ))}
              </SettingsInputField>

              <SettingsInputField
                label="SGST (%)"
                as="select"
                name="sgstRate"
                value={formData.sgstRate}
                onChange={handleFormChange}
              >
                {TAX_RATES.map(rate => (
                  <option key={rate} value={rate}>{rate}%</option>
                ))}
              </SettingsInputField>

              <SettingsInputField
                label="IGST (%)"
                as="select"
                name="igstRate"
                value={formData.igstRate}
                onChange={handleFormChange}
              >
                {TAX_RATES.map(rate => (
                  <option key={rate} value={rate}>{rate}%</option>
                ))}
              </SettingsInputField>

            </div>
            <div className="w-full max-w-xs space-y-2 text-white">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal:</span>
                <span className="font-mono">
                  {CURRENCIES[formData.currency] || ''}{totals.subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Total Tax:</span>
                <span className="font-mono">
                  {CURRENCIES[formData.currency] || ''}{totals.totalTax.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between text-xl font-bold border-t border-gray-600 pt-2">
                <span>Grand Total:</span>
                <span className="font-mono">
                  {CURRENCIES[formData.currency] || ''}{totals.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </form>
        <div className="flex justify-end space-x-4 pt-6 mt-4 flex-shrink-0 border-t border-gray-700">
          <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg text-white bg-gray-600 hover:bg-gray-500">Cancel</button>
          <button type="submit" form="quotation-form" className="px-6 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700">{isEdit ? 'Save Changes' : 'Create Quotation'}</button>
        </div>
      </div>
    </div>
  );
}

// --- Public & Detail Views ---
function QuotationDetailModal({ quotation, onClose, onDelete, companyInfo }) {
  const currencySymbol = CURRENCIES[quotation.currency] || '$';

  const handlePrint = () => {
    const printContent = document.getElementById('printable-quotation');
    const printWindow = window.open('', '', 'height=800,width=800');
    printWindow.document.write('<html><head><title>Print Quotation</title>');
    printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
    printWindow.document.write('<style>body { -webkit-print-color-adjust: exact; font-family: sans-serif; } .no-print { display: none; }</style>');
    printWindow.document.write('</head><body class="bg-white text-black">');
    printWindow.document.write(printContent.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <h2 className="text-2xl font-bold text-white">Quotation Details</h2>
          <div>
            <button onClick={() => handleShare('link', quotation, companyInfo)} className="text-purple-400 hover:text-purple-300 mr-4" title="Copy Shareable Link"><Link2 size={20} /></button>
            <button onClick={() => handleShare('whatsapp', quotation, companyInfo)} className="text-green-400 hover:text-green-300 mr-4" title="Share on WhatsApp"><Share2 size={20} /></button>
            <button onClick={() => handleShare('email', quotation, companyInfo)} className="text-yellow-400 hover:text-yellow-300 mr-4" title="Share via Email"><AtSign size={20} /></button>
            <button onClick={handlePrint} className="text-blue-400 hover:text-blue-300 mr-4" title="Print Quotation"><Printer size={20} /></button>
            <button onClick={() => onDelete(quotation.id)} className="text-red-500 hover:text-red-400 mr-4" title="Delete Quotation"><Trash2 size={20} /></button>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
          </div>
        </div>
        <div className="flex-grow overflow-y-auto bg-white text-gray-800 rounded-lg p-2">
          <PrintableQuotationView quotation={quotation} companyInfo={companyInfo} currencySymbol={currencySymbol} />
        </div>
      </div>
    </div>
  );
}

function PublicQuotationView({ data }) {
  const { quotation, companyInfo } = data;
  const currencySymbol = CURRENCIES[quotation.currency] || '$';
  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-5xl mx-auto bg-white shadow-2xl rounded-lg">
        <PrintableQuotationView quotation={quotation} companyInfo={companyInfo} currencySymbol={currencySymbol} />
      </div>
    </div>
  )
}

function PrintableQuotationView({ quotation, companyInfo, currencySymbol }) {
  return (
    <div id="printable-quotation" className="p-8">
      {/* Header */}
      <div className="flex justify-between items-start pb-8 border-b-2 border-gray-200">
        <div>
          {companyInfo.logoBase64 && <img src={companyInfo.logoBase64} alt="Company Logo" className="h-16 mb-4" />}
          <h2 className="text-2xl font-bold text-gray-900">{companyInfo.name || 'Your Company'}</h2>
          <p className="text-gray-600 whitespace-pre-line">{companyInfo.address || '123 Main St, City, State 12345'}</p>
          {companyInfo.gst && <p className="text-gray-600">GSTIN: {companyInfo.gst}</p>}
        </div>
        <div className="text-right">
          <h1 className="text-4xl font-bold uppercase text-gray-400">Quotation</h1>
          <p className="text-gray-600 mt-2"># {quotation.quotationId}</p>
          <p className="text-gray-600">Date: {new Date(quotation.date).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Client Info */}
      <div className="flex justify-between mt-8">
        <div className="text-gray-600">
          <p className="font-bold text-gray-700">BILL TO:</p>
          <p className="font-bold text-lg text-gray-900">{quotation.clientName}</p>
          <p>{quotation.clientCompany}</p>
          <p className="whitespace-pre-line">{quotation.clientAddress}</p>
          <p>{quotation.clientEmail}</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-left mt-8">
        <thead>
          <tr className="bg-gray-100 text-gray-700 uppercase text-sm">
            <th className="p-3">Item</th><th className="p-3">SAC/HSN</th><th className="p-3 text-center">Qty</th><th className="p-3 text-right">Price</th><th className="p-3 text-right">Tax</th><th className="p-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {quotation.items.map((item, index) => {
            const qty = parseFloat(item.qty) || 0;
            const price = parseFloat(item.price) || 0;
            const taxRate = parseFloat(item.taxRate) || 0;
            const itemTotal = qty * price;
            const taxAmount = itemTotal * taxRate / 100;
            return (
              <tr key={index} className="border-b border-gray-200">
                <td className="p-3">{item.description}</td><td className="p-3">{item.sac}</td><td className="p-3 text-center">{qty}</td><td className="p-3 text-right">{currencySymbol}{price.toFixed(2)}</td><td className="p-3 text-right">{currencySymbol}{taxAmount.toFixed(2)} ({taxRate}%)</td><td className="p-3 text-right font-bold">{currencySymbol}{(itemTotal + taxAmount).toFixed(2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Total */}
      <div className="flex justify-end mt-8">
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-gray-700"><p>Subtotal</p><p>{currencySymbol}{(parseFloat(quotation.subtotal) || 0).toFixed(2)}</p></div>
          {quotation.cgst > 0 && <div className="flex justify-between text-gray-700 mt-2"><p>CGST ({quotation.cgstRate}%)</p><p>{currencySymbol}{(parseFloat(quotation.cgst) || 0).toFixed(2)}</p></div>}
          {quotation.sgst > 0 && <div className="flex justify-between text-gray-700 mt-2"><p>SGST ({quotation.sgstRate}%)</p><p>{currencySymbol}{(parseFloat(quotation.sgst) || 0).toFixed(2)}</p></div>}
          {quotation.igst > 0 && <div className="flex justify-between text-gray-700 mt-2"><p>IGST ({quotation.igstRate}%)</p><p>{currencySymbol}{(parseFloat(quotation.igst) || 0).toFixed(2)}</p></div>}
          <div className="flex justify-between text-xl font-bold text-gray-900 border-t-2 border-gray-200 mt-2 pt-2"><p>Grand Total</p><p>{currencySymbol}{(parseFloat(quotation.total) || 0).toFixed(2)}</p></div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 border-t-2 border-gray-200 pt-6 text-gray-600 text-sm">
        <h4 className="font-bold text-gray-700 mb-2">Payment Terms & Conditions</h4>
        <p className="whitespace-pre-line">{quotation.paymentTerms || companyInfo.paymentTerms || 'Payment due upon receipt.'}</p>
        <p className="text-center mt-8">Thank you for your business!</p>
      </div>
    </div>
  );
}
