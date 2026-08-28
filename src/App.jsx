import { HashRouter, Routes, Route } from 'react-router-dom'
import Landing from './components/Landing.jsx'
import ChapterView from './components/ChapterView.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import PhotoAlbum from './pages/PhotoAlbum.jsx'
import SubmitChapter from './pages/SubmitChapter.jsx'
import PhotoLab from './pages/PhotoLab.jsx'
import Reunion2026 from './pages/Reunion2026.jsx'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/chapter/:id" element={<ChapterView />} />
        <Route path="/photo-album" element={<PhotoAlbum />} />
        <Route path="/submit-a-chapter" element={<SubmitChapter />} />
        <Route path="/photo-lab" element={<PhotoLab />} />
        <Route path="/reunion-2026" element={<Reunion2026 />} />
        <Route path="*" element={<Landing />} />
      </Routes>
      <SettingsPanel />
    </HashRouter>
  )
}
