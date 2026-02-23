import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{ padding: 30 }}>
      <h1>HOME</h1>
      <Link to="/chat">채팅 리스트로</Link>
    </div>
  );
}