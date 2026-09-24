import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Shell/Sidebar';
import TopBar from './components/Shell/TopBar';
import Dashboard from './pages/Dashboard';
import MachinePage from './pages/MachinePage';
import LogsPage from './pages/LogsPage';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar />
        <TopBar />
        <main className="app__content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/machine/:id" element={<MachinePage />} />
            <Route path="/logs" element={<LogsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
