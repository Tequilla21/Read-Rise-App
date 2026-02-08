import React, { useEffect, useMemo, useState } from "react";

/* =========================
   Firebase (use shared firebase.ts)
   ========================= */
import { db, auth } from "./firebase"; 
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";


/* =========================
   Types & Multi-Tenant Branding
   ========================= */
type Organization = {
  id: string;
  name: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  authProvider: "internal" | "procare" | "brightwheel";
};

type Kid = {
  id: string;
  name: string;
  gradeLevel: string;
  readingLevel: string;
  school: string;
  age?: number;
  gender?: string;
  ethnicity?: string;
  orgId: string; // New: Tracks which org this kid belongs to
};

type Family = { 
  code: string; 
  parentName: string; 
  kids: Kid[]; 
  orgId: string; // New: Tracks which org this family belongs to
};

// Default Branding (Fallback)
const DEFAULT_BRAND = {
  primary: "#2B3990",
  accent: "#FFD200",
  light: "#FFFFFF",
  mutedBg: "#F6F7FB",
  mutedText: "#4B5563",
  border: "#E5E7EB",
};

/* =========================
   Helpers
   ========================= */
function ordinal(n: number) { const s = ["th","st","nd","rd"], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
function formatPrettyDate(d=new Date()){ const wd=d.toLocaleDateString(undefined,{weekday:"long"}); const m=d.toLocaleDateString(undefined,{month:"long"}); return `${wd}, ${m} ${ordinal(d.getDate())}, ${d.getFullYear()}`; }
function getWeekKey(date=new Date()){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-day);
  const ys=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const wk=Math.ceil((((d.getTime()-ys.getTime())/86400000)+1)/7);
  return `${d.getUTCFullYear()}-W${wk}`;
}
function normalizeText(s: string){
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, "");
}
function makeBookKey(title: string, author: string){ return `${normalizeText(title)}|${normalizeText(author)}`; }
function getMonthKey(d=new Date()){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); return `${y}-${m}`; }
function getMonthLabel(d=new Date()){ return d.toLocaleDateString(undefined,{month:'long'}); }

/* =========================
   Components
   ========================= */
function useWindowSize(){
  const [s,setS]=useState({w:0,h:0});
  useEffect(()=>{ const h=()=>setS({w:window.innerWidth,h:window.innerHeight}); h(); window.addEventListener('resize',h); return()=>window.removeEventListener('resize',h);},[]);
  return s;
}

function ConfettiOverlay({show, brand}:{show:boolean, brand: any}){
  const { w } = useWindowSize();
  if(!show) return null;
  const N = 200;
  const pieces = Array.from({length:N}, ()=>({
    left: Math.random()*w,
    delay: Math.random()*1.2,
    duration: 2 + Math.random()*2.5,
    size: 6 + Math.random()*8,
    rotate: Math.random()*360,
    color: [brand.primary, brand.accent, "#FFFFFF"][Math.floor(Math.random()*3)]
  }));
  return (
    <div style={{position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:9999}}>
      <style>{`
        @keyframes fall {
          0%   { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 1; }
        }
      `}</style>
      {pieces.map((p,i)=>(
        <div
          key={i}
          style={{
            position:"absolute",
            top:-20,
            left:p.left,
            width:p.size, height:p.size,
            background:p.color,
            transform:`rotate(${p.rotate}deg)`,
            animation:`fall ${p.duration}s linear ${p.delay}s 1`,
            opacity:0.9,
            borderRadius:2,
            boxShadow:"0 0 0.5px rgba(0,0,0,0.1)"
          }}
        />
      ))}
    </div>
  );
}

function Wordmark({ brand }: { brand: any }) {
  return (
    <div
      style={{
        textAlign: "center",
        fontWeight: 900,
        fontSize: 32,
        letterSpacing: 2,
        lineHeight: 1,
        WebkitTextFillColor: brand.primary,
        WebkitTextStroke: `2px ${brand.accent}`,
        color: brand.primary,
        textShadow: `-1px -1px 0 ${brand.accent}, 1px -1px 0 ${brand.accent}, -1px 1px 0 ${brand.accent}, 1px 1px 0 ${brand.accent}`,
      }}
    >
      READ AND RISE
    </div>
  );
}

export default function App(){
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<"landing"|"orgSelect"|"parent"|"adminLogin"|"admin">("landing");
  
  // Multi-Tenant State
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const brand = activeOrg ? {
    primary: activeOrg.primaryColor,
    accent: activeOrg.accentColor,
    light: "#FFFFFF",
    mutedBg: "#F6F7FB",
    mutedText: "#4B5563",
    border: "#E5E7EB"
  } : DEFAULT_BRAND;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(!!user);
    });
    return () => unsub();
  }, []);

  const [families, setFamilies] = useState<Family[]>([]);
  const [familyCode, setFamilyCode] = useState("");
  const currentFamily = useMemo(()=> families.find(f=>f.code===familyCode.trim()) || null, [families, familyCode]);
  const [selectedKidId, setSelectedKidId] = useState("");
  const selectedKid = useMemo(()=> currentFamily?.kids.find(k=>k.id===selectedKidId) || null, [currentFamily, selectedKidId]);

  const [adminOrgSearch, setAdminOrgSearch] = useState("");
  const weekKey = getWeekKey();
  const monthKey = getMonthKey();
  const monthLabel = getMonthLabel();

  // Firestore Subscriptions filtered by activeOrg
  useEffect(()=>{
    if (!authReady || !activeOrg) return;
    
    // Only fetch families belonging to this organization
    const q = query(collection(db, "families"), where("orgId", "==", activeOrg.id));
    
    const unsub = onSnapshot(q, (snap) => {
      const next: Family[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data() as any;
        next.push({
          code: data.code,
          parentName: data.parentName,
          kids: Array.isArray(data.kids) ? data.kids : [],
          orgId: data.orgId
        });
      });
      setFamilies(next.sort((a,b)=> a.parentName.localeCompare(b.parentName)));
    });
    return () => unsub();
  }, [authReady, activeOrg]);

  // Auth "Bridge" Simulation
  const handleOrgLogin = async (orgId: string) => {
    // In a real app, you'd fetch the Org config from Firestore here
    const mockOrg: Organization = {
        id: orgId,
        name: orgId === "EAKC" ? "EAKC" : "YMCA",
        primaryColor: orgId === "EAKC" ? "#2B3990" : "#ff1100",
        accentColor: orgId === "EAKC" ? "#FFD200" : "#333333",
        logoUrl: "/eakc-logo.jpg",
        authProvider: "internal" // This would change based on org choice
    };
    setActiveOrg(mockOrg);
    setView("landing");
  };

  if (!authReady) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{minHeight: "100vh", background: `linear-gradient(180deg, ${brand.primary} 0%, #1a1a1a 100%)`}}>
      <ConfettiOverlay show={false} brand={brand} />

      {view === "landing" && (
        <div style={{minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24}}>
          <div style={{ position: "fixed", top: 16, right: 16, display: "flex", gap: 10 }}>
            <button className="btn outline" style={{background: brand.light}} onClick={() => setView("orgSelect")}>Switch Org</button>
            <button className="btn outline" style={{background: brand.light}} onClick={() => setView("adminLogin")}>Admin</button>
          </div>

          <div className="card" style={{ width:"100%", maxWidth:480, background: "#E6E6FA" }}>
            <div style={{ textAlign: "center", padding: 20 }}>
              {activeOrg && <img src={activeOrg.logoUrl} alt="Logo" style={{ height: 80, marginBottom: 10 }} />}
              <Wordmark brand={brand} />
              <div style={{ fontWeight:800, color:brand.primary, marginTop: 10 }}>
                {activeOrg ? `${activeOrg.name} Access` : "Select an Organization"}
              </div>
            </div>

            {activeOrg ? (
              <div style={{ padding: 20 }}>
                <label style={{ display:"block", marginBottom:6 }}>
                    {activeOrg.authProvider === "procare" ? "Procare Login" : "Family Code"}
                </label>
                <input
                  className="input"
                  placeholder={activeOrg.authProvider === "procare" ? "Enter Procare Email" : "Enter Family Code"}
                  value={familyCode}
                  onChange={(e)=>setFamilyCode(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
                <button
                  className="btn primary"
                  style={{ width: "100%", marginTop: 12, background: brand.primary }}
                  onClick={() => setView("parent")}
                >
                  Enter Portal
                </button>
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: "center" }}>
                <button className="btn primary" onClick={() => setView("orgSelect")}>Choose Your Program</button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "orgSelect" && (
        <div style={{minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24}}>
            <div className="card" style={{ width:"100%", maxWidth:400, background: "#fff", textAlign: "center" }}>
                <h3 style={{ color: brand.primary }}>Choose Your Organization</h3>
                <div style={{ display: "grid", gap: 10, padding: 20 }}>
                    <button className="btn outline" onClick={() => handleOrgLogin("EAKC")}>EAKC</button>
                    <button className="btn outline" onClick={() => handleOrgLogin("YMCA")}>Local YMCA</button>
                    <button className="btn outline" onClick={() => handleOrgLogin("HOME")}>Private Household</button>
                </div>
            </div>
        </div>
      )}

      {/* Admin and Parent panels would be updated similarly to include activeOrg filters */}
      
      <style>{`
        .card { border: 1px solid ${brand.border}; background: ${brand.light}; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.06); padding: 20px; }
        .input { width: 100%; padding: 10px 12px; border: 1px solid ${brand.border}; border-radius: 10px; }
        .btn { padding: 10px 14px; border-radius: 12px; cursor:pointer; border: 1px solid ${brand.border}; font-weight: 600; }
        .btn.primary { background: ${brand.primary}; color: white; border: none; }
        .btn.outline { background: transparent; color: ${brand.primary}; border: 1px solid ${brand.primary}; }
      `}</style>
    </div>
  );
}