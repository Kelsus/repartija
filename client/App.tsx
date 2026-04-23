import { Route, Switch } from 'wouter';
import Home from './pages/Home';
import Session from './pages/Session';
import Footer from './components/Footer';
import JungleDecor from './components/JungleDecor';

export default function App() {
  return (
    <div className="app">
      <JungleDecor />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/s/:code" component={Session} />
        <Route>
          <Home />
        </Route>
      </Switch>
      <Footer />
    </div>
  );
}
