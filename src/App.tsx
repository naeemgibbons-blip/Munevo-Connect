import { useState } from "react";
import PropertyChart from "./components/PropertyChart";
import BusinessChart from "./components/BusinessChart";

function App() {
  const [screen, setScreen] = useState<"property" | "business">("property");

  return (
    <div>
      <div className="flex items-center gap-2 bg-slate-800 px-4 py-1.5 text-xs">
        <button
          onClick={() => setScreen("property")}
          className={`px-2 py-1 rounded ${
            screen === "property" ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white"
          }`}
        >
          Property Chart
        </button>
        <button
          onClick={() => setScreen("business")}
          className={`px-2 py-1 rounded ${
            screen === "business" ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white"
          }`}
        >
          Business Chart
        </button>
      </div>
      {screen === "property" ? <PropertyChart /> : <BusinessChart />}
    </div>
  );
}

export default App;
