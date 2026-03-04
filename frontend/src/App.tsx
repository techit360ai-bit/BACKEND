import { Routes, Route } from "react-router"
import Landing from "@/components/Landing"
import FounderSetup from "@/dashboard/founderSetup"
import NotFound from "@/dashboard/NotFound"
import { ThemeToggle } from "@/components/ThemeToggle"

const App = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/founder/setup" element={<FounderSetup />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ThemeToggle />
    </>
  )
}

export default App
