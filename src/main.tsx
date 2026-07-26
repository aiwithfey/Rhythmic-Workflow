import React from "react";
import { createRoot } from "react-dom/client";
import RhythmCalendar from "./RhythmCalendar";

const el = document.getElementById("root");
if (el) createRoot(el).render(<RhythmCalendar />);
