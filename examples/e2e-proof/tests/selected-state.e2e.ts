import { test } from "./helpers";
import { selectedStateStopsPlayback } from "./selection";
// Passing default suite retains the repro after the reference fix.
test("[A1] choosing the selected state stops playback", selectedStateStopsPlayback);
