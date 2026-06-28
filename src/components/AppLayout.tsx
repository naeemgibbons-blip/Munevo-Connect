import { NavLink, Outlet } from "react-router-dom";

const NAV_LINKS = [
  { to: "/property/123-main-st", label: "Property Chart" },
  { to: "/business/abc-construction", label: "Business Chart" },
];

export default function AppLayout() {
  return (
    <div>
      <div className="flex items-center gap-2 bg-slate-800 px-4 py-1.5 text-xs">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `px-2 py-1 rounded ${
                isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
