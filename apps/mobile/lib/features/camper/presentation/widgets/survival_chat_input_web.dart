import 'dart:js_interop';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import 'survival_chat_input_native.dart' as native;

/// A browser-owned input lets iOS open its keyboard directly from a user tap,
/// without depending on Flutter Web's hidden input and gesture/focus handoff.
class SurvivalChatInput extends StatefulWidget {
  const SurvivalChatInput({
    super.key,
    required this.controller,
    required this.onChanged,
    required this.onSubmitted,
    this.errorText,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final String? errorText;

  @override
  State<SurvivalChatInput> createState() => _SurvivalChatInputState();
}

class _SurvivalChatInputState extends State<SurvivalChatInput> {
  web.HTMLInputElement? _input;
  final _listeners = <String, JSFunction>{};
  bool _focused = false;
  bool _composing = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_syncInput);
  }

  @override
  void didUpdateWidget(SurvivalChatInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_syncInput);
      widget.controller.addListener(_syncInput);
      _syncInput();
    }
    _input?.setAttribute('aria-invalid', '${widget.errorText != null}');
  }

  void _listen(String type, void Function(web.Event) callback) {
    final listener = callback.toJS;
    _listeners[type] = listener;
    _input!.addEventListener(type, listener);
  }

  void _createInput(Object element) {
    if (!mounted) return;
    final input = element as web.HTMLInputElement;
    _input = input;
    input
      ..type = 'text'
      ..placeholder = 'Hỏi trợ lý sinh tồn...'
      ..autocomplete = 'off'
      ..setAttribute('inputmode', 'text')
      ..setAttribute('enterkeyhint', 'send')
      ..setAttribute('aria-label', 'Nhập câu hỏi cho trợ lý sinh tồn')
      ..setAttribute('aria-invalid', '${widget.errorText != null}');
    // iOS zooms inputs smaller than 16px, which can move the composer offscreen.
    input.style
      ..width = '100%'
      ..height = '100%'
      ..boxSizing = 'border-box'
      ..border = '0'
      ..outline = 'none'
      ..padding = '${AppSpacing.sm}px ${AppSpacing.lg}px'
      ..margin = '0'
      ..backgroundColor = 'transparent'
      ..color =
          '#${AppColors.textPrimary.toARGB32().toRadixString(16).substring(2)}'
      ..fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif'
      ..fontSize = '16px'
      ..lineHeight = '24px';
    _syncInput();
    _listen('input', (_) => _readInput());
    _listen('compositionstart', (_) => _composing = true);
    _listen('compositionend', (_) {
      _composing = false;
      _readInput();
    });
    _listen('keydown', (event) {
      final key = event as web.KeyboardEvent;
      if (key.key == 'Enter' &&
          !key.isComposing &&
          key.keyCode != 229 &&
          !_composing) {
        key.preventDefault();
        widget.onSubmitted(input.value);
      }
    });
    _listen('focus', (_) {
      if (mounted) setState(() => _focused = true);
    });
    _listen('blur', (_) {
      _composing = false;
      if (mounted) setState(() => _focused = false);
    });
  }

  void _readInput() {
    final input = _input!;
    final text = input.value;
    final changed = text != widget.controller.text;
    widget.controller.value = TextEditingValue(
      text: text,
      selection: TextSelection(
        baseOffset: input.selectionStart ?? text.length,
        extentOffset: input.selectionEnd ?? text.length,
      ),
    );
    if (changed) widget.onChanged(text);
  }

  void _syncInput() {
    final input = _input;
    if (input == null || input.value == widget.controller.text) return;
    input.value = widget.controller.text;
    final selection = widget.controller.selection;
    if (selection.isValid) {
      input.setSelectionRange(selection.start, selection.end);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_syncInput);
    for (final entry in _listeners.entries) {
      _input?.removeEventListener(entry.key, entry.value);
    }
    _input?.blur();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (defaultTargetPlatform != TargetPlatform.iOS) {
      return native.SurvivalChatInput(
        controller: widget.controller,
        errorText: widget.errorText,
        onChanged: widget.onChanged,
        onSubmitted: widget.onSubmitted,
      );
    }
    return InputDecorator(
      isFocused: _focused,
      isEmpty: widget.controller.text.isEmpty,
      decoration: InputDecoration(
        errorText: widget.errorText,
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        filled: false,
        contentPadding: EdgeInsets.zero,
      ),
      child: SizedBox(
        height: 48,
        child: HtmlElementView.fromTagName(
          tagName: 'input',
          onElementCreated: _createInput,
        ),
      ),
    );
  }
}
