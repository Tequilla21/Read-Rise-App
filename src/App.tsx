import React, { useEffect, useMemo, useState } from "react";

/* =========================
   Firebase (use shared firebase.ts)
   ========================= */
import { db, auth } from "./firebase";  // ✅ your new project config
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";

/* =========================
   Branding + Helpers
   ========================= */
const BRAND = {
  primary: "#2B3990", // royal blue
  accent: "#FFD200",  // gold
  light: "#FFFFFF",
  mutedBg: "#F6F7FB",
  mutedText: "#4B5563",
  border: "#E5E7EB",
};
const LOGO_SRC = "/eakc-logo.jpg";

type Kid = {
  id: string;
  name: string;
  gradeLevel: string;
  readingLevel: string;
  school: string;
  age?: number;
  gender?: string;
  ethnicity?: string;
};
type Family = { code: string; parentName: string; kids: Kid[] };

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
function normalizeKey(s: string){ return normalizeText(s); }
function makeBookKey(title: string, author: string){ return `${normalizeText(title)}|${normalizeText(author)}`; }
function getMonthKey(d=new Date()){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); return `${y}-${m}`; }
function getMonthLabel(d=new Date()){ return d.toLocaleDateString(undefined,{month:'long'}); }

/* =========================
   Tiny confetti (no deps)
   ========================= */
function useWindowSize(){
  const [s,setS]=useState({w:0,h:0});
  useEffect(()=>{ const h=()=>setS({w:window.innerWidth,h:window.innerHeight}); h(); window.addEventListener('resize',h); return()=>window.removeEventListener('resize',h);},[]);
  return s;
}
function ConfettiOverlay({show}:{show:boolean}){
  const { w } = useWindowSize();
  if(!show) return null;
  const N = 200;
  const pieces = Array.from({length:N}, ()=>({
    left: Math.random()*w,
    delay: Math.random()*1.2,
    duration: 2 + Math.random()*2.5,
    size: 6 + Math.random()*8,
    rotate: Math.random()*360,
    color: [BRAND.primary, BRAND.accent, "#FFFFFF"][Math.floor(Math.random()*3)]
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

/* =========================
   App
   ========================= */
function ReadAndRiseWordmark() {
  return (
    <div
      style={{
        textAlign: "center",
        fontWeight: 900,
        fontSize: 32,
        letterSpacing: 2,
        lineHeight: 1,
        WebkitTextFillColor: BRAND.primary,
        WebkitTextStroke: `2px ${BRAND.accent}`,
        color: BRAND.primary,
        textShadow: `
          -1px -1px 0 ${BRAND.accent},
           1px -1px 0 ${BRAND.accent},
          -1px  1px 0 ${BRAND.accent},
           1px  1px 0 ${BRAND.accent}
        `,
      }}
    >
      READ AND RISE
    </div>
  );
}
function ParentPromiseModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-promise-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e)=>e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#E6E6FA",
          borderRadius: 16,
          border: `2px solid ${BRAND.accent}`,
          boxShadow: "0 12px 36px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 20px 0", textAlign: "center" }}>
          <div id="parent-promise-title" style={{ fontSize: 20, fontWeight: 800, color: BRAND.primary }}>
            🌟 Parent Promise Reminder 🌟
          </div>
        </div>

        <div style={{ padding: 20, color: BRAND.mutedText, fontSize: 15, lineHeight: 1.55 }}>
          <p style={{ marginTop: 0, marginBottom: 10 }}>
            <strong style={{ color: BRAND.primary }}>When parents read, children succeed.</strong><br />
            Your promise today builds their future tomorrow.
          </p>
          <p style={{ marginTop: 0, marginBottom: 10 }}>
            Together, we <strong>Read and Rise</strong> — one book, one story, one step at a time.
          </p>
          <p style={{ marginTop: 0 }}>
            Thank you for showing up, staying committed, and helping us create a community where every child thrives. 💛📚
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: 20, paddingTop: 0 }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: BRAND.primary,
              color: BRAND.light,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            I Promise
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: BRAND.light,
              color: BRAND.primary,
              border: `1px solid ${BRAND.primary}`,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App(){
  const [authReady, setAuthReady] = useState(false); // ✅ wait for anon auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => setAuthReady(true));
    signInAnonymously(auth).catch((e) => {
      console.error("Anon sign-in failed:", e);
      alert("Sign-in failed. Please refresh.");
    });
    return () => unsub();
  }, []);

  const [showParentReminder, setShowParentReminder] = useState(false);
  const [view, setView] = useState<"landing"|"parent"|"adminLogin"|"admin">("landing");

  // Families (now synced with Firestore)
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyCode, setFamilyCode] = useState("");
  const currentFamily = useMemo(()=> families.find(f=>f.code===familyCode.trim()) || null, [families, familyCode]);
  const [selectedKidId, setSelectedKidId] = useState("");
  const selectedKid = useMemo(()=> currentFamily?.kids.find(k=>k.id===selectedKidId) || null, [currentFamily, selectedKidId]);

  // Admin login
  const [adminOrg, setAdminOrg] = useState("");

  // Added Goals: per-kid (admin-managed) — local for now
  const [addedGoals, setAddedGoals] = useState<Record<string,{id:string;text:string}[]>>({});

  // Grade goals by READING LEVEL
  const [gradeGoals, setGradeGoals] = useState<Record<string, { id: string; text: string }[]>>({
    "K": [
      { id: "gk-1", text: "10-15 minutes per day" },
      { id: "gk-2", text: "10-15 pages per day" }, 
      { id: "gk-3", text: "1-2 picture books per week" }, 
    ],
    "1st": [
      { id: "g1-1", text: "15-20 minutes per day" },
      { id: "g1-2", text: "20-30 pages per week" }, 
      { id: "g1-3", text: "2-3 picture books or 1 beginner chapter book per week" }, 
    ],
    "2nd": [
      { id: "g2-1", text: "20-25 minutes per day" },
      { id: "g2-2", text: "30-40 pages per week" }, 
      { id: "g2-3", text: "1-2 beginner chapter books per week" }, 
    ],
    "3rd": [
      { id: "g3-1", text: "25-30 minutes per day" },
      { id: "g3-2", text: "40-50 pages per week" }, 
      { id: "g3-3", text: "1-2 chapter books per week" }, 
    ],
    "4th": [
      { id: "g4-1", text: "30-35 minutes per day" },
      { id: "g4-2", text: "50-60 pages per week" }, 
      { id: "g4-3", text: "2-3 chapter books per month" }, 
    ],
    "5th": [
      { id: "g5-1", text: "35-40 minutes per day" },
      { id: "g5-2", text: "50-60 pages per week" }, 
      { id: "g5-3", text: "1-2 chapter books per month" }, 
    ],
  });

  // Weekly checks — local for now
  type WeeklyState = Record<string, Record<string,{base:string[];added:string[]}> >;
  const [weeklyDone, setWeeklyDone] = useState<WeeklyState>({});
  const weekKey = getWeekKey();

  // Monthly incentives (now synced with Firestore per month)
  const [incentivesByMonth, setIncentivesByMonth] = useState<Record<string,string[]>>({});
  const monthKey = getMonthKey();
  const monthLabel = getMonthLabel();
  const currentIncentives = incentivesByMonth[monthKey] || [];

  // Reading logs — local for now
  const [logs, setLogs] = useState<Record<string,{id:string;dateISO:string;prettyDate:string;title:string;author:string;minutes:number;pages:number;mood:"red"|"orange"|"yellow"|"green"}[]>>({});

  // Schools registry (derived)
  const allKids = useMemo(()=> families.flatMap(f=>f.kids), [families]);
  const derivedSchools = useMemo(()=> Array.from(new Set(allKids.map(k=>k.school))), [allKids]);
  const [schools, setSchools] = useState<string[]>(derivedSchools);
  useEffect(()=>{ setSchools(derivedSchools); }, [derivedSchools]);

  // ======== Firestore LIVE SUBSCRIPTIONS ========
  // Families (collection "families" - doc id is the code)
  useEffect(()=>{
    if (!authReady) return; // ✅ wait for auth
    const unsub = onSnapshot(
      collection(db, "families"),
      (snap)=>{
        const next: Family[] = [];
        snap.forEach(docSnap=>{
          const data = docSnap.data() as any;
          if (data) {
            next.push({
              code: data.code,
              parentName: data.parentName,
              kids: Array.isArray(data.kids) ? data.kids : [],
            });
          }
        });
        next.sort((a,b)=> a.parentName.localeCompare(b.parentName));
        setFamilies(next);
      },
      (err) => {
        console.error("families onSnapshot error:", err);
        alert("Can’t read families (permissions).");
      }
    );
    return ()=>unsub();
  }, [authReady]);

  // Incentives: listen only to the CURRENT month doc ("incentives/{YYYY-MM}")
  useEffect(()=>{
    if (!authReady) return; // ✅ wait for auth
    const dref = doc(db, "incentives", monthKey);
    const unsub = onSnapshot(
      dref,
      (snap)=>{
        const data = snap.data() as any;
        setIncentivesByMonth(prev => ({
          ...prev,
          [monthKey]: Array.isArray(data?.items) ? data.items : [],
        }));
      },
      (err) => {
        console.error("incentives onSnapshot error:", err);
        alert("Can’t read incentives (permissions).");
      }
    );
    return ()=>unsub();
  }, [authReady, monthKey]);

  // Confetti when goals done
  const [confetti, setConfetti] = useState<{show:boolean; forKid?:string}>({show:false});
  useEffect(()=>{
    if(!selectedKid) return;
    const name = selectedKid.name;
    const allBase = (gradeGoals[selectedKid.readingLevel] || []).map(g=>g.id);
    const allAdded = (addedGoals[name]||[]).map(g=>g.id);
    const done = weeklyDone[name]?.[weekKey] || {base:[],added:[]};
    const baseDone = allBase.length? allBase.every(id=>done.base.includes(id)) : true;
    const addedDone = allAdded.length? allAdded.every(id=>done.added.includes(id)) : true;
    const hasAny = allBase.length + allAdded.length > 0;
    if(hasAny && baseDone && addedDone){
      setConfetti({show:true, forKid:name});
      const t = setTimeout(()=>setConfetti({show:false}), 3500);
      return ()=>clearTimeout(t);
    }
  }, [weeklyDone, selectedKid, gradeGoals, addedGoals, weekKey]);

  // Toggle weekly goal (local)
  function toggleWeeklyGoal(type:"base"|"added", kidName:string, goalId:string){
    setWeeklyDone(prev=>{
      const kidWeeks = prev[kidName]||{}; const curr = kidWeeks[weekKey]||{base:[],added:[]};
      const arr = type==="base"?[...curr.base]:[...curr.added];
      const i = arr.indexOf(goalId); if(i>=0) arr.splice(i,1); else arr.push(goalId);
      const updated = {...curr, [type]: arr} as {base:string[];added:string[]};
      return { ...prev, [kidName]: { ...kidWeeks, [weekKey]: updated } };
    });
  }

  // ======== Firestore-backed Admin actions ========
  async function fsUpsertFamily(code:string, parentName:string){
    try {
      const t = code.trim(); const p = parentName.trim();
      if(!t || !p){ alert("Please enter both a Parent/Family Code and a Parent Name."); return; }
      const ref = doc(db, "families", t);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        await setDoc(ref, { code: t, parentName: p, kids: Array.isArray(data?.kids)?data.kids:[] }, { merge: true });
        alert(`Code ${t} is set for ${p}.`);
      } else {
        await setDoc(ref, { code: t, parentName: p, kids: [] });
        alert(`Parent created: ${p} (${t}).`);
      }
    } catch (e:any) {
      console.error("fsUpsertFamily error:", e);
      alert("Couldn’t save parent. Check Firestore rules & auth.");
    }
  }

  async function fsAddKid(code:string, kid: Omit<Kid,"id">){
    try {
      const t = code.trim();
      const cleanKidName = kid.name.trim();
      if(!t || !cleanKidName){ alert("Please enter a Parent Code and Student Name."); return; }

      // Global duplicate name block
      const normNew = normalizeKey(cleanKidName);
      const dup = families.find(f => f.kids.some(k => normalizeKey(k.name) === normNew));
      if (dup) { alert(`A student named "${cleanKidName}" already exists under ${dup.parentName} (${dup.code}).`); return; }

      const ref = doc(db, "families", t);
      const snap = await getDoc(ref);
      if(!snap.exists()){ alert("That parent code doesn't exist yet. Please create it above."); return; }

      const data = snap.data() as any;
      const id = `id_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      const nextKids = [...(Array.isArray(data?.kids)?data.kids:[]), { id, ...kid, name: cleanKidName }];

      await updateDoc(ref, { kids: nextKids });
      // local helpers for other maps
      setAddedGoals(ag => ({ ...ag, [cleanKidName]: ag[cleanKidName] || [] }));
      setLogs(lg => ({ ...lg, [cleanKidName]: lg[cleanKidName] || [] }));
    } catch(e:any){
      console.error("fsAddKid error:", e);
      alert("Couldn’t add student. Check Firestore rules & auth.");
    }
  }

  async function fsRemoveKid(kidId:string){
    try {
      const fam = families.find(f => f.kids.some(k => k.id === kidId));
      if(!fam) return;
      const kid = fam.kids.find(k=>k.id===kidId)!;
      if(!confirm(`Remove ${kid.name}? Their goals and logs will be deleted.`)) return;

      const ref = doc(db, "families", fam.code);
      const nextKids = fam.kids.filter(k=>k.id!==kidId);
      await updateDoc(ref, { kids: nextKids });

      const n = kid.name;
      setAddedGoals(ag=>{const{[n]:_,...r}=ag;return r});
      setLogs(lg=>{const{[n]:_,...r}=lg;return r});
      setWeeklyDone(wd=>{const{[n]:_,...r}=wd;return r});
      if(selectedKidId===kidId) setSelectedKidId("");
    } catch (e:any) {
      console.error("fsRemoveKid error:", e);
      alert("Couldn’t remove student. Check Firestore rules & auth.");
    }
  }

  async function fsRemoveFamily(code:string){
    try {
      const fam = families.find(f=>f.code===code); if(!fam) return;
      if(!confirm(`Delete parent code ${code} (${fam.parentName})? This will remove ${fam.kids.length} student(s) and all their data.`)) return;
      await deleteDoc(doc(db, "families", code));
      fam.kids.forEach(k=>{
        const n=k.name;
        setAddedGoals(ag=>{const{[n]:_,...r}=ag;return r});
        setLogs(lg=>{const{[n]:_,...r}=lg;return r});
        setWeeklyDone(wd=>{const{[n]:_,...r}=wd;return r});
      });
      if(familyCode===code){ setFamilyCode(""); setSelectedKidId(""); setView("landing"); }
    } catch (e:any) {
      console.error("fsRemoveFamily error:", e);
      alert("Couldn’t remove parent. Check Firestore rules & auth.");
    }
  }

  // Incentives — current month
  async function fsAddIncentive(text:string){
    try{
      const t = text.trim(); if(!t) return;
      const dref = doc(db, "incentives", monthKey);
      const snap = await getDoc(dref);
      const items = (snap.exists() && Array.isArray((snap.data() as any).items)) ? (snap.data() as any).items : [];
      items.push(t);
      await setDoc(dref, { items }, { merge: true });
    } catch(e:any){
      console.error("fsAddIncentive error:", e);
      alert("Couldn’t add incentive. Check Firestore rules & auth.");
    }
  }
  async function fsRemoveIncentive(idx:number){
    try{
      const dref = doc(db, "incentives", monthKey);
      const snap = await getDoc(dref);
      const items = (snap.exists() && Array.isArray((snap.data() as any).items)) ? (snap.data() as any).items : [];
      if(idx>=0 && idx<items.length){ items.splice(idx,1); }
      await setDoc(dref, { items }, { merge: true });
    } catch(e:any){
      console.error("fsRemoveIncentive error:", e);
      alert("Couldn’t remove incentive. Check Firestore rules & auth.");
    }
  }

  // Reset all — clears Firestore families + incentives for safety (local states too)
  async function resetAll(){
    try{
      if(!confirm("This will remove ALL families, kids, goals, logs, incentives, schools, and checkmarks. Continue?")) return;
      const unsub = onSnapshot(collection(db,"families"), async (snap)=>{
        const batchDeletes = Promise.all(snap.docs.map(d=>deleteDoc(d.ref)));
        await batchDeletes;
      });
      unsub();
      await setDoc(doc(db,"incentives", monthKey), { items: [] });
      setFamilies([]); setFamilyCode(""); setSelectedKidId("");
      setAddedGoals({}); setLogs({}); setWeeklyDone({}); setIncentivesByMonth({});
      setSchools([]); setView("landing");
    } catch(e:any){
      console.error("resetAll error:", e);
      alert("Couldn’t reset data. Check Firestore rules & auth.");
    }
  }

  // Backup / Restore (backup is local download; restore writes to Firestore families)
  function backupAll(){
    const payload = {
      families,
      addedGoals,
      logs,
      weeklyDone,
      incentivesByMonth,
      schools,
      gradeGoals,
      meta:{version:4,exportedAt:new Date().toISOString()}
    };
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`EAKC_backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  }
  async function restoreAll(file:File){
    try{
      const text=await file.text(); const data=JSON.parse(text);
      if(!data||typeof data!=="object") throw new Error("Invalid JSON");

      if(Array.isArray(data.families)){
        for(const f of data.families){
          await setDoc(doc(db,"families", f.code), {
            code: f.code,
            parentName: f.parentName,
            kids: Array.isArray(f.kids)? f.kids : []
          });
        }
      }
      if (data.incentivesByMonth && data.incentivesByMonth[monthKey]) {
        await setDoc(doc(db,"incentives", monthKey), { items: data.incentivesByMonth[monthKey] });
      }

      setAddedGoals(data.addedGoals||{});
      setLogs(data.logs||{});
      setWeeklyDone(data.weeklyDone||{});
      setSchools(data.schools||[]);
      setGradeGoals(data.gradeGoals||{});
      setFamilyCode(""); setSelectedKidId(""); setView("landing");
      alert("Restore complete!");
    } catch(e:any){ 
      console.error("restoreAll error:", e);
      alert('Restore failed: '+(e?.message||'Unknown error')); 
    }
  }

  // runtime sanity tests
  useEffect(()=>{ const sample=new Date("2025-08-31T00:00:00Z"); console.assert(/August/.test(formatPrettyDate(sample)),"date month"); console.assert(/\d{4}-W\d{1,2}/.test(getWeekKey()),"week key"); const total=[{m:20},{m:15},{m:5}].reduce((s,x)=>s+(x.m||0),0); console.assert(total===40,"sum minutes"); },[]);

  if (!authReady) {
    return <div style={{ padding: 16, color: "#4B5563" }}>Loading…</div>;
    // (Prevents UI from rendering until Firestore can read with anon auth)
  }

  return (
    <div style={{minHeight: "100vh", background: "linear-gradient(180deg, #2B3990 0%, #1F2A6C 100%)"}}>
      <ConfettiOverlay show={confetti.show} />

      {showParentReminder && (<ParentPromiseModal onClose={()=>setShowParentReminder(false)} />)}

      {view === "landing" && (
        <div style={{minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative"}}>
          {/* Admins button (top-right) */}
          <div style={{ position: "fixed", top: 16, right: 16 }}>
            <button
              onClick={() => setView("adminLogin")}
              onMouseEnter={(e) => { e.currentTarget.style.background = BRAND.accent; e.currentTarget.style.color = "#E6E6FA"; e.currentTarget.style.borderColor = BRAND.accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#E6E6FA"; e.currentTarget.style.color = BRAND.primary; e.currentTarget.style.borderColor = BRAND.accent; }}
              style={{ padding:"10px 14px", borderRadius:12, border:`2px solid ${BRAND.accent}`, background:"#E6E6FA", color:BRAND.primary, fontWeight:600, cursor:"pointer", transition:"all 0.25s ease" }}
            >
              Admins
            </button>
          </div>

          {/* Parent Access card */}
          <div style={{ width:"100%", maxWidth:480, border:`1px solid ${BRAND.border}`, borderRadius:16, boxShadow:"0 8px 24px rgba(0,0,0,0.06)", background:"#E6E6FA" }}>
            <div style={{ padding:"20px 20px 0" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
                <img src={LOGO_SRC} alt="EAKC Logo" style={{ height: 100, width: 100, objectFit: "contain" }} />
                <ReadAndRiseWordmark />
                <div style={{ fontWeight:800, color:BRAND.primary, fontSize:20 }}>Parent Access</div>
              </div>
            </div>

            <div style={{ padding:20 }}>
              <label htmlFor="code" style={{ display:"block", marginBottom:6, color:BRAND.mutedText }}>Family Code</label>
              <input
                id="code"
                placeholder="Enter your Family Code"
                value={familyCode}
                onChange={(e)=>setFamilyCode(e.target.value)}
                onKeyDown={(e)=>{
                  if(e.key==="Enter"){
                    if (families.some(f=>f.code===familyCode.trim())) {
                      setView("parent");
                      setShowParentReminder(true);
                    } else {
                      alert("Code not found. Please contact the program admin.");
                    }
                  }
                }}
                style={{ width:"100%", padding:"10px 14px", border:`1px solid ${BRAND.border}`, borderRadius:12, fontSize:16, boxSizing:"border-box" }}
              />
              <button
                onClick={()=>{
                  if (families.some(f=>f.code===familyCode.trim())) {
                    setView("parent");
                    setShowParentReminder(true);
                  } else {
                    alert("Code not found. Please contact the program admin.");
                  }
                }}
                style={{ marginTop:12, width:"100%", padding:"10px 14px", borderRadius:12, background:BRAND.primary, color:BRAND.light, border:"none", cursor:"pointer" }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {view==="adminLogin" && (
        <div style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24}}>
          <div style={{width:"100%", maxWidth:480, border:`1px solid ${BRAND.border}`, borderRadius:16, boxShadow:"0 8px 24px rgba(0,0,0,0.06)", background:"#E6E6FA"}}>
            <div style={{padding:"20px 20px 0"}}>
              <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:12}}>
                <img src={LOGO_SRC} alt="EAKC Logo" style={{ height: 100, width: 100, objectFit: "contain" }} />
                <div style={{fontWeight:800, color:BRAND.primary, fontSize:20}}>Admin Login</div>
              </div>
            </div>

            <div style={{padding:20}}>
              <label htmlFor="org" style={{display:"block", marginBottom:6, color:BRAND.mutedText}}>Organization</label>
              <input
                placeholder="Enter org name (EAKC)"
                value={adminOrg}
                onChange={(e)=>setAdminOrg(e.target.value)}
                style={{ width:"100%", padding:"10px 14px", border:`1px solid ${BRAND.border}`, borderRadius:12, fontSize:16, boxSizing:"border-box" }}
              />

              <button
                onClick={()=>{ adminOrg.trim().toUpperCase()==="EAKC" ? setView("admin") : alert("Invalid org. Use EAKC for demo."); }}
                style={{marginTop:12, width:"100%", padding:"10px 14px", borderRadius:12, background:BRAND.primary, color:BRAND.light, border:"none", cursor:"pointer"}}
              >
                Login
              </button>

              <button
                onClick={()=>setView("landing")}
                style={{marginTop:8, width:"100%", padding:"10px 14px", borderRadius:12, background:BRAND.light, color:BRAND.primary, border:`1px solid ${BRAND.primary}`, cursor:"pointer"}}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {view==="parent" && (
        <ParentPanel
          families={families}
          familyCode={familyCode}
          selectedKidId={selectedKidId}
          setSelectedKidId={setSelectedKidId}
          selectedKid={selectedKid}
          addedGoals={addedGoals}
          weeklyDone={weeklyDone}
          weekKey={weekKey}
          incentives={currentIncentives}
          logs={logs}
          gradeGoals={gradeGoals}
          onBack={()=>{ setFamilyCode(""); setSelectedKidId(""); setView("landing"); }}
          onToggleGoal={toggleWeeklyGoal}
          onAddLog={(kidName, entry)=>{ const now=new Date(); const n={ id:`log_${Date.now()}`, dateISO:now.toISOString(), prettyDate:formatPrettyDate(now), ...entry } as const; setLogs(prev=>({ ...prev, [kidName]: [n, ...(prev[kidName]||[])] })); }}
        />
      )}

      {view==="admin" && (
        <AdminPanel
          families={families}
          addedGoals={addedGoals}
          logs={logs}
          schools={schools}
          onBack={()=>setView("landing")}

          // Firestore-backed handlers
          onUpsertFamily={fsUpsertFamily}
          onAddKid={fsAddKid}

          onAddGoal={(kidName,text)=>{ if(!kidName||!text.trim()) return; const id=`ag_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; setAddedGoals(prev=>({ ...prev, [kidName]: [...(prev[kidName]||[]), {id, text:text.trim()} ] })); }}
          onRemoveGoal={(kidName,id)=> setAddedGoals(prev=>({ ...prev, [kidName]: (prev[kidName]||[]).filter(g=>g.id!==id) }))}

          // Monthly incentives handlers (Firestore)
          incentivesForMonth={currentIncentives}
          monthLabel={monthLabel}
          onAddIncentive={fsAddIncentive}
          onRemoveIncentive={fsRemoveIncentive}

          onRemoveKid={fsRemoveKid}
          onRemoveFamily={fsRemoveFamily}
          onResetAll={resetAll}
          onBackup={backupAll}
          onRestore={restoreAll}
        />
      )}

      <style>{`
        .card { border: 1px solid ${BRAND.border}; background: ${BRAND.light}; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.06); padding: 20px; }
        .title { color: ${BRAND.primary}; font-weight: 800; text-align:center; font-size: 20px; }
        .input { width: 100%; padding: 10px 12px; border: 1px solid ${BRAND.border}; border-radius: 10px; }
        .btn { padding: 10px 14px; border-radius: 12px; cursor:pointer; border: 1px solid ${BRAND.border}; background: ${BRAND.light}; color: ${BRAND.primary}; }
        .btn.primary { background: ${BRAND.primary}; color: ${BRAND.light}; border-color: ${BRAND.primary}; }
        .btn.outline { background: ${BRAND.light}; color: ${BRAND.primary}; border-color: ${BRAND.primary}; }
        .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
        .row { display:flex; flex-direction:column; gap:8px; margin-top:12px; }
      `}</style>
    </div>
  );
}

/* =========================
   Small helpers
   ========================= */
function Center({children}:{children:React.ReactNode}){
  return <div style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24}}>{children}</div>;
}
function CardHeader({title}:{title:string}){
  return (
    <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:12}}>
      <img src={LOGO_SRC} alt="EAKC" style={{height:32, width:32, objectFit:"contain"}}/>
      <div className="title">{title}</div>
    </div>
  );
}

/* =========================
   Parent Panel + Child View
   ========================= */
function ParentPanel({
  families, familyCode, selectedKidId, setSelectedKidId, selectedKid,
  addedGoals, weeklyDone, weekKey, incentives, logs, onBack, onToggleGoal, onAddLog,
  gradeGoals,
}:{
  families: Family[];
  familyCode: string;
  selectedKidId: string;
  setSelectedKidId: (id:string)=>void;
  selectedKid: Kid | null;
  addedGoals: Record<string,{id:string;text:string}[]>;
  weeklyDone: Record<string, Record<string,{base:string[];added:string[] }>>;
  weekKey: string;
  incentives: string[];
  logs: Record<string,{ id:string; dateISO:string; prettyDate:string; title:string; author:string; minutes:number; pages:number; mood:"red"|"orange"|"yellow"|"green" }[]>;
  onBack: ()=>void;
  onToggleGoal:(type:"base"|"added", kidName:string, goalId:string)=>void;
  onAddLog:(kidName:string, entry:{ title:string; author:string; minutes:number; pages:number; mood:"red"|"orange"|"yellow"|"green" })=>void;
  gradeGoals: Record<string,{id:string;text:string}[]>;
}){
  const currentFamily = useMemo(()=> families.find(f=>f.code===familyCode.trim()) || null, [families, familyCode]);

  return (
    <Center>
      <div className="card" style={{width:"100%", maxWidth:1100}}>
        <CardHeader title="Parent Panel" />
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12}}>
          <div style={{ color: BRAND.mutedText, fontSize:14 }}>Family Code: <span style={{ color: BRAND.primary, fontWeight:600 }}>{familyCode || '—'}</span></div>
          <button className="btn outline" onClick={onBack}>Use a different code</button>
        </div>

        {/* Kids list */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:12}}>
          {currentFamily?.kids.map(kid => (
            <button
              key={kid.id}
              onClick={()=>setSelectedKidId(kid.id)}
              style={{
                padding:"14px 16px",
                border:`1px solid ${BRAND.border}`,
                borderRadius:12,
                background: selectedKidId===kid.id ? BRAND.mutedBg : BRAND.light,
                color: BRAND.primary,
                fontWeight:600,
                cursor:"pointer"
              }}
            >{kid.name}</button>
          ))}
        </div>

        <div style={{marginTop:18}}>
          {selectedKid ? (
            <ChildView
              kid={selectedKid}
              gradeGoals={gradeGoals}
              addedGoals={addedGoals}
              weeklyDone={weeklyDone}
              weekKey={weekKey}
              incentives={[...incentives]}
              logs={logs}
              onToggleGoal={(type,id)=>onToggleGoal(type, selectedKid.name, id)}
              onAddLog={(entry)=> onAddLog(selectedKid.name, entry)}
            />
          ) : (
            <div style={{ color: BRAND.mutedText, fontSize:14 }}>Select a child to view details.</div>
          )}
        </div>
      </div>
    </Center>
  );
}

function ChildView({
  kid, gradeGoals, addedGoals, weeklyDone, weekKey, incentives, logs, onToggleGoal, onAddLog
}:{
  kid: Kid;
  gradeGoals: Record<string,{id:string;text:string}[]>;
  addedGoals: Record<string,{id:string;text:string}[]>;
  weeklyDone: Record<string, Record<string,{base:string[];added:string[]}>>;
  weekKey: string;
  incentives: string[];
  logs: Record<string,{ id:string; dateISO:string; prettyDate:string; title:string; author:string; minutes:number; pages:number; mood:"red"|"orange"|"yellow"|"green" }[]>;
  onToggleGoal:(type:"base"|"added", id:string)=>void;
  onAddLog:(entry:{ title:string; author:string; minutes:number; pages:number; mood:"red"|"orange"|"yellow"|"green" })=>void;
}){
  const doneState = weeklyDone[kid.name]?.[weekKey] || {base:[],added:[]};
  const gradeBasedGoals = gradeGoals[kid.readingLevel] || [];

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [minutes, setMinutes] = useState<number|"">("");
  const [pages, setPages] = useState<number|"">("");
  const [mood, setMood] = useState<"red"|"orange"|"yellow"|"green">("green");
  const moodLabel: Record<string,string> = { red:"😡 Red", orange:"😕 Orange", yellow:"🙂 Yellow", green:"😃 Green" };

  const totalMinutes = (logs[kid.name]||[]).reduce((s,row)=>s+(row.minutes||0),0);

  return (
    <div style={{position:"relative", marginTop:8}}>
      <div style={{textAlign:"center", color:BRAND.primary, fontWeight:800, fontSize:22, marginBottom:8}}>{kid.name}</div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", alignItems:"center", color:BRAND.mutedText, fontSize:13, marginBottom:12}}>
        <div style={{textAlign:"left"}}>{kid.gradeLevel}</div>
        <div style={{textAlign:"center"}}>{kid.school}</div>
        <div style={{textAlign:"right"}}><span style={{ color: BRAND.primary }}>Reading Level:</span> {kid.readingLevel}</div>
      </div>

      <div style={{border:`1px solid ${BRAND.border}`, background:BRAND.mutedBg, borderRadius:14, padding:12, marginBottom:12}}>
        <div style={{fontWeight:700, marginBottom:6, color:BRAND.primary}}>{getMonthLabel()} Incentives</div>
        <ul style={{margin:0, paddingLeft:18, color:BRAND.mutedText, fontSize:14}}>
          {incentives.length ? incentives.map((inc,i)=> <li key={i}>{inc}</li>) : <li>No incentives set yet.</li>}
        </ul>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
        <div>
          <div style={{fontWeight:700, marginBottom:6, color:BRAND.primary}}>Goals</div>
          <div style={{display:"grid", gap:8}}>
            {gradeBasedGoals.length ? (
              gradeBasedGoals.map(g=> (
                <label key={g.id} style={{display:"flex", alignItems:"center", gap:10, border:`1px solid ${BRAND.border}`, borderRadius:12, padding:10}}>
                  <input type="checkbox" checked={doneState.base.includes(g.id)} onChange={()=>onToggleGoal("base", g.id)} />
                  <span>{g.text}</span>
                </label>
              ))
            ) : (
              <div style={{ color: BRAND.mutedText, fontSize:14 }}>No base goals set for reading level {kid.readingLevel}.</div>
            )}
          </div>
        </div>
        <div>
          <div style={{fontWeight:700, marginBottom:6, color:BRAND.primary}}>Added Goals (Admin)</div>
          <div style={{display:"grid", gap:8}}>
            {(addedGoals[kid.name] && addedGoals[kid.name].length>0) ? (
              addedGoals[kid.name].map(g=> (
                <label key={g.id} style={{display:"flex", alignItems:"center", gap:10, border:`1px solid ${BRAND.border}`, borderRadius:12, padding:10}}>
                  <input type="checkbox" checked={doneState.added.includes(g.id)} onChange={()=>onToggleGoal("added", g.id)} />
                  <span>{g.text}</span>
                </label>
              ))
            ) : (
              <div style={{ color: BRAND.mutedText, fontSize:14 }}>No added goals yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Add Reading Entry */}
      <div style={{ border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: 12, marginTop: 12, overflow: "hidden" }}>
        <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 8 }}>Add Reading Entry</div>
        <div style={{ display: "grid", gap: 10, alignItems: "start", minWidth: 0 }}>
          <div className="row" style={{ minWidth: 0 }}>
            <label>Book Title</label>
            <input className="input" style={{ width: "100%", boxSizing: "border-box" }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Ada Twist, Scientist" />
          </div>
          <div className="row" style={{ minWidth: 0 }}>
            <label>Author</label>
            <input className="input" style={{ width: "100%", boxSizing: "border-box" }} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g., Andrea Beaty" />
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", minWidth: 0 }}>
            <div className="row" style={{ minWidth: 0 }}>
              <label>Minutes Read</label>
              <input className="input" style={{ width: "100%", boxSizing: "border-box" }} type="number" value={String(minutes)} onChange={(e) => setMinutes(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g., 20" />
            </div>
            <div className="row" style={{ minWidth: 0 }}>
              <label>Pages Read</label>
              <input className="input" style={{ width: "100%", boxSizing: "border-box" }} type="number" value={String(pages)} onChange={(e) => setPages(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g., 12" />
            </div>
          </div>
          <div className="row" style={{ minWidth: 0 }}>
            <label>How did the book feel?</label>
            <select className="input" style={{ width: "100%", boxSizing: "border-box" }} value={mood} onChange={(e) => setMood(e.target.value as any)}>
              <option value="red">😡 Red: I didn’t like this book — It wasn’t fun, confusing, or not your style.</option>
              <option value="orange">😕 Orange: The book was okay — Some parts were good, but you didn’t fully enjoy it.</option>
              <option value="yellow">🙂 Yellow: I liked this book — It was fun and interesting, but not a favorite.</option>
              <option value="green">😃 Green: I loved this book! — Super fun, exciting, and you’d read it again.</option>
            </select>
          </div>
        </div>
        <button
          className="btn primary"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => {
            if (!title.trim()) return;
            onAddLog({ title: title.trim(), author: author.trim(), minutes: Number(minutes) || 0, pages: Number(pages) || 0, mood });
            setTitle(""); setAuthor(""); setMinutes(""); setPages(""); setMood("green");
          }}
        >
          Save Entry
        </button>
      </div>

      <div style={{border:`1px solid ${BRAND.border}`, borderRadius:14, padding:12, marginTop:12}}>
        <div style={{fontWeight:700, color:BRAND.primary, marginBottom:6}}>Reading Log</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%", fontSize:14, borderCollapse:"collapse"}}>
            <thead>
              <tr style={{ color: BRAND.primary, textAlign:"left" }}>
                <th style={{padding:8}}>Date</th>
                <th style={{padding:8}}>Title</th>
                <th style={{padding:8}}>Author</th>
                <th style={{padding:8}}>Minutes</th>
                <th style={{padding:8}}>Pages</th>
                <th style={{padding:8}}>Mood</th>
              </tr>
            </thead>
            <tbody>
              {(logs[kid.name] && logs[kid.name].length>0) ? (
                logs[kid.name].map(row => (
                  <tr key={row.id} style={{ borderTop:`1px solid ${BRAND.border}`, color: BRAND.mutedText }}>
                    <td style={{padding:8, whiteSpace:"nowrap"}}>{row.prettyDate}</td>
                    <td style={{padding:8}}>{row.title}</td>
                    <td style={{padding:8}}>{row.author}</td>
                    <td style={{padding:8}}>{row.minutes}</td>
                    <td style={{padding:8}}>{row.pages}</td>
                    <td style={{padding:8}}>{moodLabel[row.mood]}</td>
                  </tr>
                ))
              ) : (
                <tr><td style={{padding:8, color:BRAND.mutedText}} colSpan={6}>No entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{marginTop:6, textAlign:"right", fontSize:13, color:BRAND.mutedText}}>
          Total minutes: <span style={{ color: BRAND.primary, fontWeight:600 }}>
            {totalMinutes}
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Admin Panel (right side includes incentives)
   ========================= */
function AdminPanel({
  families, addedGoals, logs, schools, onBack,
  onUpsertFamily, onAddKid, onAddGoal, onRemoveGoal,
  onRemoveKid, onRemoveFamily, onResetAll, onBackup, onRestore,
  incentivesForMonth, monthLabel, onAddIncentive, onRemoveIncentive
}:{
  families: Family[];
  addedGoals: Record<string,{id:string;text:string}[]>;
  logs: Record<string,{ title?: string; author?: string; minutes: number }[]>;
  schools: string[];
  onBack: ()=>void;
  onUpsertFamily: (code:string, parentName: string)=>void;
  onAddKid: (code:string, kid: Omit<Kid,"id">)=>void;
  onAddGoal: (kidName:string, text:string)=>void;
  onRemoveGoal: (kidName:string, id:string)=>void;
  onRemoveKid: (kidId:string)=>void;
  onRemoveFamily: (code:string)=>void;
  onResetAll: ()=>void;
  onBackup: ()=>void;
  onRestore: (file:File)=>void;
  incentivesForMonth: string[];
  monthLabel: string;
  onAddIncentive: (text:string)=>void;
  onRemoveIncentive: (idx:number)=>void;
})
{
  // Inputs
  const [parentName, setParentName] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [name, setName] = useState("");
  const [school, setSchool] = useState(schools[0] || "Barrack Obama Elementary");
  const [newSchool, setNewSchool] = useState("");
  const [readingLevel, setReadingLevel] = useState("K");
  const [gradeLevel, setGradeLevel] = useState("4th grade");
  const [gender, setGender] = useState("Female");
  const [ethnicity, setEthnicity] = useState("Black / African American");
  const [age, setAge] = useState<number>(9);

  // Parent selection & toast
  const [selectedParentCode, setSelectedParentCode] = useState<string>("");
  const [toast, setToast] = useState<string>("");
  useEffect(()=>{ if(!toast) return; const t = setTimeout(()=>setToast(""), 2200); return ()=>clearTimeout(t); }, [toast]);

  const allStudents = useMemo(()=> families.flatMap(f=>f.kids), [families]);

  // Dashboard calcs
  const [gradeFilter, setGradeFilter] = useState<string>("All");
  const minutesByStudent = useMemo(()=>{ const m:Record<string,number>={}; allStudents.forEach(s=>{ m[s.name]=(logs[s.name]||[] as any[]).reduce((sum:any,r:any)=>sum+(r.minutes||0),0); }); return m; }, [allStudents, logs]);
  const booksByStudent = useMemo(() => {
    const m: Record<string, number> = {};
    allStudents.forEach(s => {
      const set = new Set<string>();
      (logs[s.name] || []).forEach((r: any) => {
        if (r.title && r.author) set.add(makeBookKey(r.title, r.author));
      });
      m[s.name] = set.size;
    });
    return m;
  }, [allStudents, logs]);
  const grades = useMemo(()=> Array.from(new Set(allStudents.map(s=>s.gradeLevel))), [allStudents]);
  const filtered = useMemo(()=> allStudents.filter(s=> gradeFilter==="All" ? true : s.gradeLevel===gradeFilter), [allStudents, gradeFilter]);
  const totalForGrade = useMemo(()=> filtered.reduce((sum,s)=> sum + (minutesByStudent[s.name]||0),0), [filtered, minutesByStudent]);
  const booksTotalForGrade = useMemo(()=> filtered.reduce((sum, s) => sum + (booksByStudent[s.name] || 0), 0), [filtered, booksByStudent]);

  const inputId = "restore-json-input";
  const triggerRestore = ()=>{ (document.getElementById(inputId) as HTMLInputElement | null)?.click(); };

  function exportCSV(){
    const rows:string[]=[];
    const headers=["ParentCode","ParentName","Name","Age","Gender","Ethnicity","School","Grade","ReadingLevel","MinutesTotal"];
    rows.push(headers.join(","));
    families.forEach(f=>{
      f.kids.forEach(k=>{
        const total=(logs[k.name]||[] as any[]).reduce((s:any,r:any)=>s+(r.minutes||0),0);
        const vals=[f.code,f.parentName,k.name,k.age??"",k.gender??"",k.ethnicity??"",k.school,k.gradeLevel,k.readingLevel,total]
          .map(v=> typeof v==="string"? `"${String(v).replaceAll('"','""')}"` : String(v));
        rows.push(vals.join(","));
      });
    });
    const blob=new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`EAKC_export_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function handleSelectParent(code:string, name:string){
    const ok = confirm(`Use ${name} (${code})?`);
    if(!ok) return;
    setFamilyCode(code); setParentName(name); setSelectedParentCode(code); setToast(`Using ${name} (${code})`);
  }

  async function handleUseCreateParent(){
    await onUpsertFamily(familyCode, parentName);
    setSelectedParentCode(familyCode.trim());
    setToast(`Parent ready: ${parentName.trim()} (${familyCode.trim()})`);
  }

  async function handleAddStudent(){
    if (!familyCode.trim() || !parentName.trim()){
      alert("Please enter Parent Code and Parent Name, then click Use / Create Parent.");
      return;
    }
    if (!name.trim()) return;
    const effective = newSchool.trim() ? newSchool.trim() : school;
    await onAddKid(familyCode, { name, school: effective, readingLevel, gradeLevel, age, gender, ethnicity });
    setToast(`Student "${name.trim()}" added under ${parentName.trim()} (${familyCode.trim()})`);
    setName(""); setNewSchool("");
  }

  return (
    <Center>
      {toast && (
        <div style={{ position:"fixed", top:12, left:"50%", transform:"translateX(-50%)", background:"#111827", color:"#fff", padding:"10px 14px", borderRadius:10, fontSize:14, boxShadow:"0 8px 24px rgba(0,0,0,0.15)", zIndex:9999 }}>
          {toast}
        </div>
      )}

      <div className="card" style={{width:"100%", maxWidth:1200}}>
        <CardHeader title="Admin Panel — EAKC" />
        <div style={{display:"flex", flexWrap:"wrap", gap:8, justifyContent:"flex-end", marginBottom:12}}>
          <button className="btn outline" onClick={exportCSV}>Export CSV</button>
          <button className="btn outline" onClick={onBackup}>Backup (JSON)</button>
          <input id={inputId} type="file" accept="application/json" style={{display:"none"}} onChange={(e)=>{ const f=e.target.files?.[0]; if(f) onRestore(f); (e.target as HTMLInputElement).value=''; }} />
          <button className="btn outline" onClick={triggerRestore}>Restore JSON</button>
          <button className="btn outline" onClick={onBack}>Back to Landing</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
          {/* LEFT column */}
          <div style={{ display: "grid", gap: 16 }}>
            {/* BOX 1: Parent Info */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 8 }}>Parent Info</div>

              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", alignItems: "start", minWidth: 0 }}>
                <div className="row" style={{ minWidth: 0, marginTop: 0 }}>
                  <label>Parent/Family Code</label>
                  <input className="input" style={{ width: "100%", boxSizing: "border-box" }} placeholder="e.g., 1234" value={familyCode} onChange={(e) => setFamilyCode(e.target.value)} />
                </div>
                <div className="row" style={{ minWidth: 0, marginTop: 0 }}>
                  <label>Parent Name</label>
                  <input className="input" style={{ width: "100%", boxSizing: "border-box" }} placeholder="e.g., Jordan Williams" value={parentName} onChange={(e) => setParentName(e.target.value)} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", minWidth: 0 }}>
                <button className="btn outline" onClick={handleUseCreateParent}>Use / Create Parent</button>
                <button className="btn" style={{ borderColor: "#DC2626", color: "#DC2626" }} onClick={() => familyCode && onRemoveFamily(familyCode)}>
                  Delete Parent Code
                </button>
              </div>

              {/* Parent list */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 6 }}>Parents</div>
                <div style={{ border: `1px solid ${BRAND.border}`, background: BRAND.mutedBg, borderRadius: 12, padding: 8, maxHeight: 220, overflow: "auto" }}>
                  {families.length ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      {families.map((f) => {
                        const selected = selectedParentCode === f.code;
                        return (
                          <button
                            key={f.code}
                            onClick={() => handleSelectParent(f.code, f.parentName)}
                            style={{
                              textAlign: "left",
                              padding: "10px 12px",
                              border: `1px solid ${selected ? BRAND.primary : BRAND.border}`,
                              background: selected ? "#EEF2FF" : "#fff",
                              color: BRAND.primary,
                              borderRadius: 10,
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 8,
                            }}
                            title="Click to use this parent"
                          >
                            <span style={{ fontWeight: 600 }}>{f.parentName}</span>
                            <span style={{ fontSize: 12, color: BRAND.mutedText }}>Code: {f.code}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ color: BRAND.mutedText, fontSize: 14 }}>No parents yet.</div>
                  )}
                </div>
              </div>
            </div>

            {/* BOX 2: Student Info */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 8 }}>Student Info</div>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "start", minWidth: 0 }}>
                <div className="row" style={{ minWidth: 0 }}>
                  <label>Student Name</label>
                  <input className="input" style={{ width: "100%", boxSizing: "border-box" }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Alex" />
                </div>
                <div className="row" style={{ minWidth: 0 }}>
                  <label>Age</label>
                  <select className="input" style={{ width: "100%", boxSizing: "border-box" }} value={String(age)} onChange={(e) => setAge(Number(e.target.value))}>
                    {Array.from({ length: 14 }, (_, i) => 5 + i).map((a) => (<option key={a} value={a}>{a}</option>))}
                  </select>
                </div>
                <div className="row" style={{ minWidth: 0 }}>
                  <label>Gender</label>
                  <select className="input" style={{ width: "100%", boxSizing: "border-box" }} value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option>
                  </select>
                </div>
                <div className="row" style={{ minWidth: 0 }}>
                  <label>Ethnicity</label>
                  <select className="input" style={{ width: "100%", boxSizing: "border-box" }} value={ethnicity} onChange={(e) => setEthnicity(e.target.value)}>
                    <option>Black / African American</option><option>Hispanic / Latino</option><option>White</option><option>Asian</option>
                    <option>Native American / Alaska Native</option><option>Native Hawaiian / Pacific Islander</option><option>Other / Multiple</option><option>Prefer not to say</option>
                  </select>
                </div>
                <div className="row" style={{ minWidth: 0 }}>
                  <label>School</label>
                  <select className="input" style={{ width: "100%", boxSizing: "border-box" }} value={school} onChange={(e) => setSchool(e.target.value)}>
                    {schools.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" style={{ width: "100%", boxSizing: "border-box" }} placeholder="Add new school" value={newSchool} onChange={(e) => setNewSchool(e.target.value)} />
                    <button className="btn outline" onClick={() => { if (newSchool.trim()) setSchool(newSchool.trim()); }}>Use</button>
                  </div>
                </div>
                <div className="row" style={{ minWidth: 0 }}>
                  <label>Reading Level</label>
                  <select className="input" style={{ width: "100%", boxSizing: "border-box" }} value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)}>
                    {["K", "1st", "2nd", "3rd", "4th", "5th"].map((l) => (<option key={l} value={l}>{l}</option>))}
                  </select>
                </div>
                <div className="row" style={{ minWidth: 0 }}>
                  <label>Grade Level</label>
                  <select className="input" style={{ width: "100%", boxSizing: "border-box" }} value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
                    {["K","1st grade","2nd grade","3rd grade","4th grade","5th grade"].map((g) => (<option key={g} value={g}>{g}</option>))}
                  </select>
                </div>
              </div>
              <button className="btn primary" style={{ marginTop: 8 }} onClick={handleAddStudent}>Add Student to Parent</button>
            </div>

            {/* Roster */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: BRAND.primary }}>
                Roster — Remove Student
              </div>
              <div style={{ border: `1px solid ${BRAND.border}`, background: BRAND.mutedBg, borderRadius: 12, padding: 12, maxHeight: 260, overflow: "auto", marginTop: 8 }}>
                <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: BRAND.primary, textAlign: "left" }}>
                      <th style={{ padding: 8 }}>Student</th>
                      <th style={{ padding: 8 }}>Parent Code</th>
                      <th style={{ padding: 8 }}>Parent Name</th>
                      <th style={{ padding: 8 }}>School</th>
                      <th style={{ padding: 8 }}>Grade</th>
                      <th style={{ padding: 8 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allStudents.length ? (
                      allStudents.map((s) => {
                        const fam = families.find((f) => f.kids.some((k) => k.id === s.id));
                        return (
                          <tr key={s.id} style={{ borderTop: `1px solid ${BRAND.border}` }}>
                            <td style={{ padding: 8 }}>{s.name}</td>
                            <td style={{ padding: 8 }}>{fam?.code || "—"}</td>
                            <td style={{ padding: 8 }}>{fam?.parentName || "—"}</td>
                            <td style={{ padding: 8 }}>{s.school}</td>
                            <td style={{ padding: 8 }}>{s.gradeLevel}</td>
                            <td style={{ padding: 8 }}>
                              <button className="btn" style={{ borderColor: "#DC2626", color: "#DC2626" }} onClick={() => onRemoveKid(s.id)}>Remove</button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td style={{ padding: 8, color: BRAND.mutedText }} colSpan={6}>No students yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT column */}
          <div style={{ display: "grid", gap: 16 }}>
            {/* Manage Added Goals (local) */}
            <ManageAddedGoals allStudents={allStudents} addedGoals={addedGoals} onAddGoal={onAddGoal} onRemoveGoal={onRemoveGoal} />

            {/* Monthly Incentives (Firestore) */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 6 }}>{monthLabel} Incentives</div>
              <IncentivesEditor items={incentivesForMonth} onAdd={onAddIncentive} onRemove={onRemoveIncentive} />
            </div>

            {/* Minutes Dashboard (local) */}
            <MinutesDashboard
              wrapperClass="card"
              allStudents={allStudents}
              booksByStudent={booksByStudent}
              minutesByStudent={minutesByStudent}
              grades={grades}
              gradeFilter={gradeFilter}
              setGradeFilter={setGradeFilter}
              totalForGrade={totalForGrade}
              booksTotalForGrade={booksTotalForGrade}
            />

            {/* Danger Zone */}
            <div className="card" style={{ padding: 16, background: "#FEF2F2", borderColor: "#FCA5A5", textAlign: "center", justifySelf: "center", width: "100%", maxWidth: 420 }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, color: "#DC2626", fontWeight: 700, marginBottom: 6 }}>Danger Zone</div>
              <p style={{ color: BRAND.mutedText, fontSize: 14, marginTop: 0 }}>Reset the app for a new year. This removes ALL students, goals, logs, and parent codes.</p>
              <button className="btn primary" onClick={onResetAll}>Reset All</button>
            </div>
          </div>
        </div>
      </div>
    </Center>
  );
}

function IncentivesEditor({ items, onAdd, onRemove }:{ items:string[]; onAdd:(t:string)=>void; onRemove:(i:number)=>void }){
  const [text, setText] = useState("");
  return (
    <>
      <div className="row" style={{ minWidth: 0 }}>
        <label>Add incentive</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" placeholder="e.g., Pizza party" value={text} onChange={(e)=>setText(e.target.value)} />
          <button className="btn primary" onClick={()=>{ if(text.trim()) { onAdd(text.trim()); setText(""); }}}>Add</button>
        </div>
      </div>
      <div style={{ marginTop: 10, border:`1px solid ${BRAND.border}`, background: BRAND.mutedBg, borderRadius: 12, padding: 10, maxHeight: 220, overflow:"auto" }}>
        {items.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {items.map((it,i)=>(
              <li key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, border:`1px solid ${BRAND.border}`, borderRadius:10, padding:"6px 8px", marginBottom:8 }}>
                <span>{it}</span>
                <button className="btn" style={{ borderColor:"#DC2626", color:"#DC2626" }} onClick={()=>onRemove(i)}>Remove</button>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: BRAND.mutedText, fontSize: 14 }}>No incentives yet.</div>
        )}
      </div>
    </>
  );
}

function ManageAddedGoals({
  allStudents,
  addedGoals,
  onAddGoal,
  onRemoveGoal,
}: {
  allStudents: Kid[];
  addedGoals: Record<string, { id: string; text: string }[]>;
  onAddGoal: (kidName: string, text: string) => void;
  onRemoveGoal: (kidName: string, id: string) => void;
}) {
  const [goalKidName, setGoalKidName] = useState("");
  const [newGoalText, setNewGoalText] = useState("");

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, color: BRAND.primary, marginBottom: 6 }}>Manage Added Goals (Admin)</div>

      <div className="row" style={{ minWidth: 0 }}>
        <label>Pick Student</label>
        <select className="input" value={goalKidName} onChange={(e) => setGoalKidName(e.target.value)}>
          <option value="">— Select —</option>
          {allStudents.map((k) => (<option key={k.id} value={k.name}>{k.name}</option>))}
        </select>
      </div>

      <div className="row" style={{ minWidth: 0 }}>
        <label>New Goal</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" placeholder="e.g., Read 15 minutes" value={newGoalText} onChange={(e) => setNewGoalText(e.target.value)} />
          <button className="btn primary" onClick={() => { if (goalKidName && newGoalText.trim()) { onAddGoal(goalKidName, newGoalText.trim()); setNewGoalText(""); }}}>
            Add
          </button>
        </div>
      </div>

      <div style={{ border: `1px solid ${BRAND.border}`, background: BRAND.mutedBg, borderRadius: 12, padding: 12, maxHeight: 260, overflow: "auto", marginTop: 8 }}>
        {goalKidName ? (
          addedGoals[goalKidName]?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {addedGoals[goalKidName].map((g) => (
                <li key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, border: `1px solid ${BRAND.border}`, borderRadius: 10, padding: "6px 8px", marginBottom: 8 }}>
                  <span>{g.text}</span>
                  <button className="btn" style={{ borderColor: "#DC2626", color: "#DC2626" }} onClick={() => onRemoveGoal(goalKidName, g.id)}>Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: BRAND.mutedText, fontSize: 14 }}>No added goals yet for {goalKidName}.</div>
          )
        ) : (
          <div style={{ color: BRAND.mutedText, fontSize: 14 }}>Select a student to view and edit goals.</div>
        )}
      </div>
    </div>
  );
}

function MinutesDashboard({
  wrapperClass,
  allStudents, booksByStudent, minutesByStudent,
  grades, gradeFilter, setGradeFilter,
  totalForGrade, booksTotalForGrade
}:{
  wrapperClass?: string;
  allStudents: Kid[];
  booksByStudent: Record<string, number>;
  minutesByStudent: Record<string, number>;
  grades: string[];
  gradeFilter: string;
  setGradeFilter: (x:string)=>void;
  totalForGrade: number;
  booksTotalForGrade: number;
}){
  const filtered = useMemo(()=> allStudents.filter(s=> gradeFilter==="All" ? true : s.gradeLevel===gradeFilter), [allStudents, gradeFilter]);

  return (
    <div className={wrapperClass} style={{padding:16}}>
      <label style={{fontWeight:700, color:BRAND.primary}}>Minutes Dashboard</label>
      <div style={{display:"flex", alignItems:"center", gap:8, marginTop:6}}>
        <span style={{ color: BRAND.mutedText, fontSize:14 }}>Filter by grade:</span>
        <select className="input" style={{maxWidth:200}} value={gradeFilter} onChange={(e)=>setGradeFilter(e.target.value)}>
          <option value="All">All</option>
          {grades.map(g=> <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div style={{border:`1px solid ${BRAND.border}`, background:BRAND.mutedBg, borderRadius:12, padding:12, marginTop:8, overflowX:"auto"}}>
        <table style={{width:"100%", fontSize:14, borderCollapse:"collapse"}}>
          <thead>
            <tr style={{ color: BRAND.primary, textAlign:"left" }}>
              <th style={{padding:8}}>Student</th>
              <th style={{padding:8}}>Grade</th>
              <th style={{padding:8}}>Minutes (total)</th>
              <th style={{padding:8}}>Books (unique)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s=> (
              <tr key={s.id} style={{ borderTop:`1px solid ${BRAND.border}` }}>
                <td style={{padding:8}}>{s.name}</td>
                <td style={{padding:8}}>{s.gradeLevel}</td>
                <td style={{padding:8}}>{(minutesByStudent[s.name]||0)}</td>
                <td style={{padding:8}}>{(booksByStudent[s.name]||0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight:700, color: BRAND.primary }}>
              <td style={{padding:8}}>Total</td>
              <td style={{padding:8}}>{gradeFilter}</td>
              <td style={{padding:8}}>{totalForGrade}</td>
              <td style={{padding:8}}>{booksTotalForGrade}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
