import React from 'react';
import ReactDOM from 'react-dom/client';


import HomePage from './HomePage.tsx';

const App = () => <HomePage />;

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
