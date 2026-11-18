import 'package:flutter/material.dart';
import '../../../core/widgets/ctms_button.dart';
import '../porter_review_strings.dart';
import 'porter_reviews_screen.dart';

class PorterReviewEntryButton extends StatelessWidget {
  const PorterReviewEntryButton({super.key, this.bookingId, this.tripTitle});
  final String? bookingId, tripTitle;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: CtmsButton(
      label: PorterReviewStrings.title,
      icon: Icons.support_agent,
      variant: CtmsButtonVariant.secondary,
      onPressed: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              PorterReviewsScreen(bookingId: bookingId, tripTitle: tripTitle),
        ),
      ),
    ),
  );
}
