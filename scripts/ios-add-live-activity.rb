# Adds the Live Activity widget extension to ios/App/App.xcodeproj.
# Safe to run more than once. Run from the repo root:
#   ruby scripts/ios-add-live-activity.rb
require "xcodeproj"

PROJECT = File.expand_path("../ios/App/App.xcodeproj", __dir__)
EXT_NAME = "RSLiftWidget"
APP_BUNDLE_ID = "com.runstronglift.app"
DEPLOYMENT = "16.2"

project = Xcodeproj::Project.open(PROJECT)
app = project.targets.find { |t| t.name == "App" } or abort "App target not found"

def group_for(project, path, name)
  project.main_group.groups.find { |g| g.path == path } || project.main_group.new_group(name, path)
end

def file_in(group, name)
  group.files.find { |f| f.path == name } || group.new_reference(name)
end

# --- App target: the plugin, the view controller and the shared attributes ----
app_group = project.main_group.groups.find { |g| g.path == "App" } or abort "App group not found"
shared = group_for(project, "Shared", "Shared")
attrs = file_in(shared, "WorkoutActivityAttributes.swift")
plugin = file_in(app_group, "LiveActivityPlugin.swift")
vc = file_in(app_group, "MainViewController.swift")
[attrs, plugin, vc].each do |f|
  app.source_build_phase.add_file_reference(f, true) unless app.source_build_phase.files_references.include?(f)
end

# --- Widget extension target --------------------------------------------------
ext = project.targets.find { |t| t.name == EXT_NAME }
unless ext
  ext = project.new_target(:app_extension, EXT_NAME, :ios, DEPLOYMENT, nil, :swift)
end

ext_group = group_for(project, EXT_NAME, EXT_NAME)
%w[RSLiftWidgetBundle.swift WorkoutLiveActivity.swift].each do |name|
  ref = file_in(ext_group, name)
  ext.source_build_phase.add_file_reference(ref, true) unless ext.source_build_phase.files_references.include?(ref)
end
file_in(ext_group, "Info.plist")
ext.source_build_phase.add_file_reference(attrs, true) unless ext.source_build_phase.files_references.include?(attrs)

%w[WidgetKit SwiftUI].each do |fw|
  path = "System/Library/Frameworks/#{fw}.framework"
  next if ext.frameworks_build_phase.files_references.any? { |r| r.path == path }
  ref = project.frameworks_group.files.find { |r| r.path == path } ||
        project.frameworks_group.new_reference(path, :sdk_root)
  ext.frameworks_build_phase.add_file_reference(ref, true)
end

ext.build_configurations.each do |config|
  s = config.build_settings
  s["PRODUCT_NAME"] = "$(TARGET_NAME)"
  s["PRODUCT_BUNDLE_IDENTIFIER"] = "#{APP_BUNDLE_ID}.#{EXT_NAME}"
  s["INFOPLIST_FILE"] = "#{EXT_NAME}/Info.plist"
  s["GENERATE_INFOPLIST_FILE"] = "NO"
  s["IPHONEOS_DEPLOYMENT_TARGET"] = DEPLOYMENT
  s["SWIFT_VERSION"] = "5.0"
  s["TARGETED_DEVICE_FAMILY"] = "1"
  s["SKIP_INSTALL"] = "YES"
  s["CODE_SIGN_STYLE"] = "Automatic"
  s["MARKETING_VERSION"] = "1.0"
  s["CURRENT_PROJECT_VERSION"] = "1"
  s["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks"]
  s["ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME"] = "AccentColor"
end

# Build the extension with the app, and embed it.
app.add_dependency(ext) unless app.dependencies.any? { |d| d.target == ext }
embed = app.copy_files_build_phases.find { |p| p.name == "Embed Foundation Extensions" }
unless embed
  embed = app.new_copy_files_build_phase("Embed Foundation Extensions")
  embed.dst_subfolder_spec = "13" # PlugIns
end
unless embed.files_references.include?(ext.product_reference)
  bf = embed.add_file_reference(ext.product_reference, true)
  bf.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
end

project.save
puts "Live Activity widget target is set up in #{PROJECT}"
