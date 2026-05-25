import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { DepthPainterPage } from "./features/depth-painter/DepthPainterPage";
import { GeneratorPage } from "./features/generator/GeneratorPage";
import { PatternMakerPage } from "./features/pattern-maker/PatternMakerPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/generator" replace />} />
        <Route path="generator" element={<GeneratorPage />} />
        <Route path="depth-painter" element={<DepthPainterPage />} />
        <Route path="pattern-maker" element={<PatternMakerPage />} />
      </Route>
    </Routes>
  );
}
