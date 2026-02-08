import React, { useEffect, useMemo, useState, useRef } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/* =========================
   Types
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
  orgId: string;
};

type Family = { 
  code: string; 
  parentName: string; 
  kids: Kid[]; 
  orgId: string; 
};

type ReadingSession = {
  id?: string;
  kidId: string;
  orgId: string;
  bookTitle: string;
  transcript: string;
  accuracy: number;
  date: any;
};

const DEFAULT_BRAND = {
  primary: "#2B3990",
  accent: "#FFD200",
  light: "#FFFFFF",
  border: "#E5E7EB",
};

/* =========================
   Main App Component
   ========================= */
export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<"landing"|"orgSelect"|"parent"|"adminLogin"|"admin"|"readingTest">("landing");
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyCode, setFamilyCode] = useState("");
  const [selectedKidId, setSelectedKidId] = useState("");
  
  // AI Reading State
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const brand = activeOrg ? {
    primary: activeOrg.primaryColor,
    accent: activeOrg.accentColor,
    light: "#FFFFFF",
    border: "#E5E7EB"
  } : DEFAULT_BRAND;

  const currentFamily = useMemo(() => families.find(f => f.code === familyCode.trim()) || null, [families, familyCode]);
  const selectedKid = useMemo(() => currentFamily?.kids.find(k => k.id === selectedKidId) || null, [currentFamily, selectedKidId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setAuthReady(!!user));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !activeOrg) return;
    const q = query(collection(db, "families"), where("orgId", "==", activeOrg.id));
    return onSnapshot(q, (snap) => {
      const next: Family[] = [];
      snap.forEach(d => next.push(d.data() as Family));
      setFamilies(next);
    });
  }, [authReady, activeOrg]);

  /* =========================
     AI Reading Logic
     ========================= */
  const startAssessment = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("AI Reading is not supported in this browser. Please use Chrome.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event: any) => {
      let current = "";
      for (let i = 0; i < event.results.length; i++) {
        current += event.results[i][0].transcript;
      }
      setTranscript(current);
    };

    recognitionRef.current.start();
    setIsRecording(true);
  };

  const stopAssessment = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    
    // Save Assessment to Firestore
    if (selectedKid && activeOrg) {
      await addDoc(collection(db, "reading_sessions"), {
        kidId: selectedKid.id,
        orgId: activeOrg.id,
        transcript: transcript,
        date: serverTimestamp(),
        // We will add the AI "Grade Level" analysis in the next step
      });
      alert("Reading session saved! AI is analyzing the level...");
      setView("parent");
    }
  };

  if (!authReady) return <div style={{ padding: 20 }}>Initializing...</div>;

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${brand.primary} 0%, #1a1a1a 100%)`, color: "#fff", fontFamily: "sans-serif" }}>
      
      {/* Landing View */}
      {view === "landing" && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
          <div style={{ background: "#fff", color: "#333", padding: 30, borderRadius: 20, width: 350, textAlign: "center" }}>
             {activeOrg && <img src={activeOrg.logoUrl} style={{ width: 60 }} alt="logo" />}
             <h2>Read and Rise</h2>
             <p>{activeOrg ? activeOrg.name : "Select an Organization to Start"}</p>
             
             {activeOrg ? (
               <>
                 <input 
                   placeholder="Enter Family Code" 
                   style={{ width: "100%", padding: 10, margin: "10px 0", borderRadius: 8, border: "1px solid #ccc" }}
                   value={familyCode}
                   onChange={(e) => setFamilyCode(e.target.value)}
                 />
                 <button 
                   style={{ width: "100%", padding: 12, background: brand.primary, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
                   onClick={() => setView("parent")}
                 >
                   Log In
                 </button>
               </>
             ) : (
               <button className="btn" onClick={() => setView("orgSelect")}>Choose Program</button>
             )}
          </div>
        </div>
      )}

      {/* Org Select View */}
      {view === "orgSelect" && (
        <div style={{ padding: 40, textAlign: "center" }}>
          <h3>Select Your Program</h3>
          <button onClick={() => { setActiveOrg({ id: "EAKC", name: "EAKC", primaryColor: "#2B3990", accentColor: "#FFD200", logoUrl: "", authProvider: "internal" }); setView("landing"); }}>EAKC</button>
          <button style={{ marginLeft: 10 }} onClick={() => { setActiveOrg({ id: "YMCA", name: "YMCA", primaryColor: "#ff1100", accentColor: "#333", logoUrl: "", authProvider: "internal" }); setView("landing"); }}>YMCA</button>
        </div>
      )}

      {/* Parent/Kid Selector View */}
      {view === "parent" && currentFamily && (
        <div style={{ padding: 20 }}>
          <h2>Welcome, {currentFamily.parentName}</h2>
          <p>Select a child to log reading or start an AI assessment:</p>
          {currentFamily.kids.map(kid => (
            <div key={kid.id} style={{ background: "rgba(255,255,255,0.1)", padding: 15, borderRadius: 12, marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
              <span>{kid.name} (Grade: {kid.gradeLevel})</span>
              <button 
                onClick={() => { setSelectedKidId(kid.id); setView("readingTest"); }}
                style={{ background: brand.accent, border: "none", padding: "5px 10px", borderRadius: 5, fontWeight: "bold" }}
              >
                Start AI Reading
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reading Test View (The AI Part) */}
      {view === "readingTest" && selectedKid && (
        <div style={{ padding: 30, textAlign: "center" }}>
          <button onClick={() => setView("parent")} style={{ float: "left", color: "#fff", background: "none", border: "none" }}>← Back</button>
          <h2>Reading Assessment</h2>
          <p>Child: <strong>{selectedKid.name}</strong></p>
          
          <div style={{ background: "#fff", color: "#333", minHeight: 200, borderRadius: 15, padding: 20, margin: "20px 0", fontSize: 20 }}>
            {transcript || "Click 'Start' and have the child read a page from their book out loud..."}
          </div>

          {!isRecording ? (
            <button 
              onClick={startAssessment}
              style={{ padding: "15px 40px", fontSize: 18, borderRadius: 50, border: "none", background: "#2ecc71", color: "#fff", cursor: "pointer" }}
            >
              🎤 Start Reading
            </button>
          ) : (
            <button 
              onClick={stopAssessment}
              style={{ padding: "15px 40px", fontSize: 18, borderRadius: 50, border: "none", background: "#e74c3c", color: "#fff", cursor: "pointer" }}
            >
              Stop & Analyze
            </button>
          )}
        </div>
      )}

    </div>
  );
}