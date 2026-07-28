import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

const modules = [
	"Offline survival package",
	"GPS route deviation alerts",
	"Buffer & sync tracking",
];

export default function App() {
	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar style="dark" />
			<View style={styles.container}>
				<Text style={styles.label}>CTMS Mobile</Text>
				<Text style={styles.title}>Camper and porter field app</Text>
				{modules.map((module) => (
					<View style={styles.item} key={module}>
						<Text style={styles.itemText}>{module}</Text>
					</View>
				))}
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		backgroundColor: "#f5f7f3",
		flex: 1,
	},
	container: {
		flex: 1,
		gap: 14,
		padding: 24,
	},
	label: {
		color: "#527567",
		fontSize: 13,
		fontWeight: "700",
		textTransform: "uppercase",
	},
	title: {
		color: "#1c261f",
		fontSize: 34,
		fontWeight: "800",
		lineHeight: 38,
		marginBottom: 12,
	},
	item: {
		backgroundColor: "#ffffff",
		borderColor: "#dfe8df",
		borderRadius: 8,
		borderWidth: 1,
		padding: 16,
	},
	itemText: {
		color: "#334139",
		fontSize: 16,
		fontWeight: "600",
	},
});
