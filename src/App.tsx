import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import PropertyChart from "./pages/PropertyChart";
import BusinessChart from "./pages/BusinessChart";
import AgendaSync from "./pages/admin/AgendaSync";
import PropertyDispositions from "./pages/PropertyDispositions";
import DepartmentBudgets from "./pages/DepartmentBudgets";
import LegislativePortal from "./pages/LegislativePortal";

function Nav() {
  return (
    <div className="flex items-center gap-2 bg-slate-800 px-4 py-1.5 text-xs">
      <Link
        to="/property-chart"
        className="px-2 py-1 rounded text-slate-300 hover:text-white"
      >
        Property Chart
      </Link>
      <Link
        to="/business-chart"
        className="px-2 py-1 rounded text-slate-300 hover:text-white"
      >
        Business Chart
      </Link>
      <Link
        to="/admin/agenda-sync"
        className="px-2 py-1 rounded text-slate-300 hover:text-white"
      >
        Agenda Sync
      </Link>
      <Link
        to="/property-dispositions"
        className="px-2 py-1 rounded text-slate-300 hover:text-white"
      >
        Property Dispositions
      </Link>
      <Link
        to="/department-budgets"
        className="px-2 py-1 rounded text-slate-300 hover:text-white"
      >
        Department Budgets
      </Link>
      <Link
        to="/legislative-portal"
        className="px-2 py-1 rounded text-slate-300 hover:text-white"
      >
        Legislative Portal
      </Link>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<PropertyChart />} />
        <Route path="/property-chart" element={<PropertyChart />} />
        <Route path="/business-chart" element={<BusinessChart />} />
        <Route path="/admin/agenda-sync" element={<AgendaSync />} />
        <Route path="/property-dispositions" element={<PropertyDispositions />} />
        <Route path="/department-budgets" element={<DepartmentBudgets />} />
        <Route path="/legislative-portal" element={<LegislativePortal />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
