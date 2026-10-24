#!/usr/bin/env bun
import { loadControlMetrics } from "./lib/load-metrics.js";

const m = await loadControlMetrics();
console.log(JSON.stringify(m, null, 2));
