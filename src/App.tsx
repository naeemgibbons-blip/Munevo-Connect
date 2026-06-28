import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import PropertyChart from "./components/PropertyChart";
import BusinessChart from "./components/BusinessChart";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/property/123-main-st" replace />} />
          <Route path="/property/:id" element={<PropertyChart />} />
          <Route path="/business/:id" element={<BusinessChart />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
