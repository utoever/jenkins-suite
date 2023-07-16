import React from 'react';
import { LazyLog } from 'react-lazylog';
import './log-panel.css';

const LogPanel = ({ logs }) => {
  return (
    <div>
      <LazyLog text={logs} height={500} />
    </div>
  );
};

export default LogPanel;
