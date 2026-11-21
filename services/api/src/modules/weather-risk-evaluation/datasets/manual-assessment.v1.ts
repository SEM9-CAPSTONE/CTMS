import { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";
import { WeatherManualAssessmentDatasetStatus } from "../weather-risk-evaluation.enums";
import type {
	WeatherManualAssessmentCase,
	WeatherManualAssessmentDataset,
} from "./manual-assessment.types";

/**
 * Data only. Each case is the worst hourly reading of a trekking day in the Đà Nẵng / Quảng Nam
 * mountains, labelled by how a trekking guide would judge the day (Green: go as planned; Yellow:
 * go with extra care or a shorter plan; Red: do not go). Labels were drafted by the dev team
 * from the weather decision policy WITHOUT running the scorer, and stay a draft until an approved
 * evaluator confirms them; reports on a draft dataset are INVALID.
 * Never edit a case of this version: add manual-assessment.v2 instead.
 */
const c = (
	id: string,
	rainfallMm: number,
	windKph: number,
	temperatureC: number,
	visibilityM: number,
	thunderstorm: boolean,
	manualLevel: RiskLevel,
	boundary: boolean,
	note: string
): WeatherManualAssessmentCase => ({
	id,
	readings: { rainfallMm, windKph, temperatureC, visibilityM, thunderstorm },
	manualLevel,
	boundary,
	note,
});

const { GREEN, YELLOW, RED } = RiskLevel;

export const WEATHER_MANUAL_ASSESSMENT_V1: WeatherManualAssessmentDataset = {
	version: "v1-2026-11-draft",
	status: WeatherManualAssessmentDatasetStatus.DRAFT,
	description:
		"60 trekking-day cases (20 Green, 20 Yellow, 20 Red; 18 near a threshold) drafted from the weather decision policy; awaiting confirmation by a guide or the leader.",
	approvedBy: null,
	approvedAt: null,
	cases: [
		// Green: the trip goes as planned.
		c("G01", 0, 8, 26, 20000, false, GREEN, false, "Clear sunny day, light breeze"),
		c("G02", 0.5, 12, 24, 15000, false, GREEN, false, "Partly cloudy, a few drops"),
		c("G03", 2, 15, 22, 12000, false, GREEN, false, "Light drizzle in the afternoon"),
		c("G04", 0, 20, 30, 18000, false, GREEN, false, "Hot but comfortable with breeze"),
		c("G05", 1, 10, 18, 10000, false, GREEN, false, "Cool morning on the ridge"),
		c("G06", 3, 18, 25, 9000, false, GREEN, false, "Short light shower"),
		c("G07", 0, 5, 16, 8000, false, GREEN, false, "Calm, slight morning haze"),
		c("G08", 0, 25, 28, 20000, false, GREEN, false, "Breezy and dry"),
		c("G09", 4, 14, 23, 11000, false, GREEN, false, "Light rain, good visibility"),
		c("G10", 0, 10, 33, 16000, false, GREEN, false, "Warm, dry, sunny"),
		c("G11", 1.5, 22, 20, 14000, false, GREEN, false, "Overcast, light wind"),
		c("G12", 0, 16, 12, 10000, false, GREEN, false, "Chilly but clear highland morning"),
		c("G13", 2.5, 12, 27, 13000, false, GREEN, false, "Passing light shower"),
		c("G14", 0, 30, 26, 20000, false, GREEN, false, "Fresh wind on open ridge, dry"),
		c(
			"G15",
			9,
			20,
			24,
			8000,
			false,
			GREEN,
			true,
			"Moderate rain just under 10 mm/h, otherwise fine"
		),
		c("G16", 3, 38, 25, 12000, false, GREEN, true, "Wind just under 40 km/h, dry trail"),
		c("G17", 1, 15, 36, 15000, false, GREEN, true, "Hot 36°C, just under the heat band"),
		c("G18", 0, 10, 6, 9000, false, GREEN, true, "Cold 6°C, just above the cold band"),
		c("G19", 2, 12, 22, 5500, false, GREEN, true, "Haze 5.5 km, trail still easy to follow"),
		c("G20", 5, 30, 21, 7000, false, GREEN, true, "Light rain with fresh wind, nothing severe"),
		// Yellow: go with extra care, shorter plan or rain gear.
		c("Y01", 18, 22, 24, 6000, false, YELLOW, false, "Steady rain, slippery trail"),
		c("Y02", 25, 30, 23, 4000, false, YELLOW, false, "Heavy showers, reduced visibility"),
		c("Y03", 6, 50, 22, 9000, false, YELLOW, false, "Strong gusts on the ridge"),
		c("Y04", 4, 15, 39, 15000, false, YELLOW, false, "Very hot, heat exhaustion risk"),
		c("Y05", 2, 12, 3, 8000, false, YELLOW, false, "Near freezing at the summit"),
		c("Y06", 5, 18, 21, 2500, false, YELLOW, false, "Thick fog, navigation harder"),
		c("Y07", 6, 20, 25, 7000, true, YELLOW, false, "Isolated thunderstorm in the afternoon"),
		c("Y08", 30, 35, 22, 5000, false, YELLOW, false, "Heavy rain spells most of the day"),
		c("Y09", 12, 45, 20, 6000, false, YELLOW, false, "Rain with strong wind"),
		c("Y10", 20, 20, 26, 3000, false, YELLOW, false, "Persistent rain and mist"),
		c("Y11", 8, 55, 18, 7000, false, YELLOW, false, "Very windy on exposed sections"),
		c("Y12", 15, 25, 4, 6000, false, YELLOW, false, "Cold rain at altitude"),
		c("Y13", 0, 20, 40, 14000, false, YELLOW, false, "Extreme heat, plan early start"),
		c("Y14", 22, 28, 24, 4500, false, YELLOW, false, "Heavy rain bands passing through"),
		c("Y15", 10, 30, 23, 8000, false, YELLOW, true, "Rain right at 10 mm/h for hours"),
		c("Y16", 3, 40, 24, 10000, false, YELLOW, true, "Wind right at 40 km/h"),
		c("Y17", 2, 15, 38, 12000, false, YELLOW, true, "Heat right at 38°C"),
		c("Y18", 1, 10, 5, 9000, false, YELLOW, true, "Cold right at 5°C"),
		c("Y19", 4, 18, 22, 5000, false, YELLOW, true, "Visibility right at 5 km in mist"),
		c("Y20", 45, 35, 22, 3500, false, YELLOW, true, "Very heavy rain, just under the Red mark"),
		// Red: do not go.
		c("R01", 60, 40, 22, 2000, false, RED, false, "Torrential rain, flash flood risk on streams"),
		c("R02", 80, 55, 21, 1500, true, RED, false, "Tropical storm rain bands"),
		c("R03", 15, 85, 20, 6000, false, RED, false, "Gale-force wind on the ridge"),
		c("R04", 5, 20, 22, 300, false, RED, false, "Dense fog, visibility 300 m"),
		c("R05", 30, 45, 22, 3000, true, RED, false, "Thunderstorm with heavy rain"),
		c("R06", 0, 30, -2, 8000, false, RED, false, "Frost and ice at the summit"),
		c("R07", 2, 15, 43, 12000, false, RED, false, "Extreme heat 43°C"),
		c("R08", 100, 70, 23, 800, true, RED, false, "Typhoon landfall"),
		c("R09", 55, 30, 24, 4000, false, RED, false, "Cloudburst, landslide risk"),
		c("R10", 10, 95, 18, 5000, false, RED, false, "Storm-force gusts"),
		c("R11", 40, 60, 20, 1200, true, RED, false, "Severe thunderstorm with strong wind"),
		c("R12", 25, 75, 21, 2500, false, RED, false, "Strong wind and heavy rain"),
		c("R13", 70, 50, 22, 900, false, RED, false, "Flooding rain and very low visibility"),
		c("R14", 12, 40, 1, 700, false, RED, false, "Freezing fog on the summit trail"),
		c("R15", 50, 30, 23, 4500, false, RED, true, "Rain right at 50 mm/h"),
		c("R16", 8, 70, 22, 8000, false, RED, true, "Wind right at 70 km/h"),
		c("R17", 3, 18, 22, 1000, false, RED, true, "Visibility right at 1 km in fog"),
		c("R18", 0, 15, 0, 9000, false, RED, true, "Temperature right at 0°C"),
		c("R19", 1, 12, 42, 13000, false, RED, true, "Heat right at 42°C"),
		c("R20", 35, 65, 21, 1800, true, RED, true, "Thunderstorm, wind just under 70 km/h"),
	],
};
