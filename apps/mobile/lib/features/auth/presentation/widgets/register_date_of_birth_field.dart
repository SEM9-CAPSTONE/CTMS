import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../register_strings.dart';

/// "Ngày sinh" — a [FormField] wrapping [showDatePicker] so it validates
/// alongside the rest of the surrounding `Form` (same contract as a
/// `TextFormField`), without faking a `TextEditingController` for a value
/// the user never actually types.
class RegisterDateOfBirthField extends StatelessWidget {
  const RegisterDateOfBirthField({super.key, required this.value, required this.onChanged});

  final DateTime? value;
  final ValueChanged<DateTime> onChanged;

  static final _format = DateFormat('dd/MM/yyyy');

  @override
  Widget build(BuildContext context) {
    return FormField<DateTime>(
      initialValue: value,
      validator: (selected) => selected == null ? RegisterStrings.dateOfBirthError : null,
      builder: (field) {
        return InkWell(
          onTap: () async {
            final now = DateTime.now();
            final picked = await showDatePicker(
              context: context,
              initialDate: field.value ?? DateTime(now.year - 20),
              firstDate: DateTime(now.year - 100),
              lastDate: now,
            );
            if (picked != null) {
              field.didChange(picked);
              onChanged(picked);
            }
          },
          child: InputDecorator(
            decoration: InputDecoration(
              labelText: RegisterStrings.dateOfBirthLabel,
              prefixIcon: const Icon(Icons.cake_outlined),
              errorText: field.errorText,
            ),
            child: Text(field.value == null ? '' : _format.format(field.value!)),
          ),
        );
      },
    );
  }
}
