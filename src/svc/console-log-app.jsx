import React from 'react';
import LogPanel from './log-panel';

const ConsoleLogApp = () => {
  const logs = '로그의 내용을 여기에 전달합니다.';

  return (
    <div>
      <h1>Jenkins Console Log</h1>
      <LogPanel logs={logs} />
    </div>
  );
};

export default ConsoleLogApp;
