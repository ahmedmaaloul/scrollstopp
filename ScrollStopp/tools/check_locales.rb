#!/usr/bin/env ruby
# frozen_string_literal: true

# Checks the translations:
#   * en and de define exactly the same keys and placeholders
#   * every key used in HTML, JS and manifest.json exists in both languages
#   * no hardcoded visible text sits in the HTML files
#   * at least 10 motivating lines per language
#
#   ruby tools/check_locales.rb      (exit code 1 if something is wrong)

require 'json'

root = File.expand_path('..', __dir__)
errors = []
warnings = []

locales = Dir[File.join(root, '_locales', '*', 'messages.json')].to_h do |path|
  [File.basename(File.dirname(path)), JSON.parse(File.read(path))]
end
abort 'No locales found' if locales.empty?

# 1. Same keys, non empty messages, consistent placeholders.
all_keys = locales.values.flat_map(&:keys).uniq
locales.each do |lang, messages|
  (all_keys - messages.keys).each { |key| errors << "#{lang}: missing key #{key}" }
  messages.each do |key, entry|
    text = entry['message'].to_s
    errors << "#{lang}: #{key} is empty" if text.strip.empty?
    used = text.scan(/\$([A-Za-z0-9_]+)\$/).flatten.map(&:downcase).uniq
    defined = (entry['placeholders'] || {}).keys.map(&:downcase)
    (used - defined).each { |name| errors << "#{lang}: #{key} uses $#{name.upcase}$ without a placeholder" }
    (defined - used).each { |name| warnings << "#{lang}: #{key} defines unused placeholder #{name}" }
  end
end
locales.keys.combination(2).each do |a, b|
  (locales[a].keys & locales[b].keys).each do |key|
    pa = (locales[a][key]['placeholders'] || {}).keys.map(&:downcase).sort
    pb = (locales[b][key]['placeholders'] || {}).keys.map(&:downcase).sort
    errors << "#{key}: placeholders differ between #{a} and #{b}" unless pa == pb
  end
end

# 2. Keys used in code.
code_files = Dir[File.join(root, '**', '*.{html,js,json}')].reject { |f| f.include?('/_locales/') || f.include?('/memes/') }
static_keys = {}
prefixes = {}
code_files.each do |file|
  src = File.read(file)
  rel = file.delete_prefix("#{root}/")
  src.scan(/data-i18n(?:-[a-z-]+)?="([A-Za-z0-9_]+)"/) { |(k)| (static_keys[k] ||= []) << rel }
  src.scan(/__MSG_([A-Za-z0-9_]+)__/) { |(k)| (static_keys[k] ||= []) << rel }
  src.scan(/\b(?:t|getMessage)\(\s*['"`]([A-Za-z0-9_]+)['"`]/) { |(k)| (static_keys[k] ||= []) << rel }
  src.scan(/\b(?:t|getMessage)\(\s*`([A-Za-z0-9_]+)\$\{/) { |(p)| (prefixes[p] ||= []) << rel }
end

locales.each do |lang, messages|
  static_keys.each do |key, files|
    errors << "#{lang}: key #{key} (used in #{files.uniq.join(', ')}) is missing" unless messages.key?(key)
  end
  prefixes.each do |prefix, files|
    next if messages.keys.any? { |k| k.match?(/\A#{prefix}\d+\z/) }
    errors << "#{lang}: no #{prefix}N keys (used in #{files.uniq.join(', ')})"
  end
  count = messages.keys.count { |k| k.match?(/\Amotivation\d+\z/) }
  errors << "#{lang}: only #{count} motivating lines, need at least 10" if count < 10
end

dynamic = ->(key) { prefixes.keys.any? { |p| key.match?(/\A#{p}\d+\z/) } }
(all_keys - static_keys.keys).reject(&dynamic).each { |key| warnings << "unused key #{key}" }

# 3. Hardcoded text in HTML (everything visible should come from data-i18n).
Dir[File.join(root, '**', '*.html')].each do |file|
  html = File.read(file).gsub(/<(script|style|svg)\b.*?<\/\1>/m, '').gsub(/<!--.*?-->/m, '')
  html.scan(/>([^<]+)</).flatten.map(&:strip).reject(&:empty?).each do |text|
    errors << "#{file.delete_prefix("#{root}/")}: hardcoded text #{text.inspect}" if text.match?(/\p{L}/)
  end
end

warnings.each { |w| puts "warning: #{w}" }
if errors.empty?
  puts "OK: #{locales.keys.sort.join(' + ')} define #{all_keys.size} keys each, " \
       "#{static_keys.size} used directly, #{prefixes.size} dynamic prefixes (#{prefixes.keys.join(', ')})."
else
  errors.each { |e| puts "error: #{e}" }
  exit 1
end
