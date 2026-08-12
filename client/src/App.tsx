import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GameProvider } from "./contexts/GameContext";
import Home from "./pages/Home";
import Solo from "./pages/Solo";
import Multi from "./pages/Multi";
import GameEnd from "./pages/GameEnd";
import History from "./pages/History";

function Router() {
  return (
    <GameProvider>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/solo"} component={Solo} />
        <Route path={"/multi"} component={Multi} />
        <Route path={"/end"} component={GameEnd} />
        <Route path={"/history"} component={History} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </GameProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster position="top-center" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
