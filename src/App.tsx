/* ... existing imports and types ... */

type Incentive = {
  id: string;
  title: string;
  pointsRequired: number;
  description: string;
  icon: string; // e.g., "🍕", "🎮", "📚"
};

/* ... inside your App component ... */

export default function App() {
  // Add this to your state list
  const [view, setView] = useState<"landing"|"orgSelect"|"parent"|"adminLogin"|"admin"|"readingTest"|"prizes">("landing");
  const [kidPoints, setKidPoints] = useState(150); // Mock points for now

  const incentives: Incentive[] = [
    { id: "1", title: "Extra Recess", pointsRequired: 50, description: "15 minutes of extra outdoor time!", icon: "⚽" },
    { id: "2", title: "Pizza Party", pointsRequired: 200, description: "One personal pan pizza coupon.", icon: "🍕" },
    { id: "3", title: "Pick a Prize Box", pointsRequired: 100, description: "Choose one toy from the treasure chest.", icon: "🎁" },
  ];

  /* ... rest of your UI logic ... */

  return (
    <div style={{ /* ... your existing styles ... */ }}>
      
      {/* ADD THIS: Prize Shop View */}
      {view === "prizes" && selectedKid && (
        <div style={{ padding: 20 }}>
          <button onClick={() => setView("parent")} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>← Back</button>
          
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 32 }}>🏆 Prize Shop</h2>
            <div style={{ background: brand.accent, color: brand.primary, display: "inline-block", padding: "10px 20px", borderRadius: 20, fontWeight: "bold", fontSize: 24 }}>
              {kidPoints} Points Available
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
            {incentives.map(item => (
              <div key={item.id} style={{ background: "white", color: "#333", borderRadius: 15, padding: 15, textAlign: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.2)" }}>
                <div style={{ fontSize: 40 }}>{item.icon}</div>
                <h4 style={{ margin: "10px 0 5px 0" }}>{item.title}</h4>
                <p style={{ fontSize: 12, color: "#666", minHeight: 40 }}>{item.description}</p>
                <button 
                  disabled={kidPoints < item.pointsRequired}
                  style={{ 
                    width: "100%", 
                    padding: 8, 
                    borderRadius: 8, 
                    border: "none", 
                    background: kidPoints >= item.pointsRequired ? brand.primary : "#ccc", 
                    color: "white",
                    fontWeight: "bold"
                  }}
                >
                  {kidPoints >= item.pointsRequired ? `Redeem ${item.pointsRequired}pts` : "Need More Points"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Update your Kid list in the 'parent' view to include a "Prizes" button */}
      {/* ... where you map through kids ... */}
      <button onClick={() => { setSelectedKidId(kid.id); setView("prizes"); }} style={{ marginLeft: 10, background: "#fff", color: brand.primary, border: "none", padding: "5px 10px", borderRadius: 5 }}>
        🎁 Shop
      </button>

    </div>
  );
}