import 'package:flutter/material.dart';
import 'trip_member_locations_panel.dart';

class CamperMemberLocationsPanel extends StatelessWidget {
  const CamperMemberLocationsPanel({
    super.key,
    required this.tripId,
    this.clock,
  });
  final String tripId;
  final DateTime Function()? clock;

  @override
  Widget build(BuildContext context) =>
      TripMemberLocationsPanel(tripId: tripId, clock: clock);
}
